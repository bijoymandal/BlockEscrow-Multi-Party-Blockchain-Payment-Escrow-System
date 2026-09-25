const { agreementSchema, deliverableSchema, disputeSchema } = require("./schemas");

/**
 * Validates whether a string is a valid Ethereum checksummed or lowercase 40-char hex address.
 */
function isEthereumAddress(address) {
  if (typeof address !== "string") return false;
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validates ISO-8601 date string.
 */
function isValidIsoDate(str) {
  if (typeof str !== "string") return false;
  const d = new Date(str);
  return !isNaN(d.getTime()) && str.includes("T");
}

/**
 * Validates numerical decimal strings (e.g. "100", "50.25").
 */
function isValidAmountString(amount) {
  if (typeof amount !== "string") return false;
  return /^[0-9]+(\.[0-9]+)?$/.test(amount) && parseFloat(amount) > 0;
}

/**
 * Validates an agreement payload against the agreement schema.
 */
function validateAgreement(data) {
  const errors = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Data must be a non-null object"] };
  }

  // Required fields
  const required = ["version", "title", "buyer", "seller", "arbitrator", "totalAmount", "tokenSymbol", "milestones"];
  for (const field of required) {
    if (data[field] === undefined || data[field] === null || data[field] === "") {
      errors.push(`Missing required field: '${field}'`);
    }
  }

  if (data.version !== "1.0.0") {
    errors.push("Invalid version: must be '1.0.0'");
  }

  if (typeof data.title !== "string" || data.title.length < 3 || data.title.length > 150) {
    errors.push("Field 'title' must be a string between 3 and 150 characters");
  }

  if (!isEthereumAddress(data.buyer)) {
    errors.push("Field 'buyer' must be a valid 40-char hex address starting with 0x");
  }
  if (!isEthereumAddress(data.seller)) {
    errors.push("Field 'seller' must be a valid 40-char hex address starting with 0x");
  }
  if (!isEthereumAddress(data.arbitrator)) {
    errors.push("Field 'arbitrator' must be a valid 40-char hex address starting with 0x");
  }

  if (data.buyer && data.seller && data.buyer.toLowerCase() === data.seller.toLowerCase()) {
    errors.push("Buyer and Seller addresses cannot be identical");
  }
  if (data.buyer && data.arbitrator && data.buyer.toLowerCase() === data.arbitrator.toLowerCase()) {
    errors.push("Buyer and Arbitrator addresses cannot be identical");
  }
  if (data.seller && data.arbitrator && data.seller.toLowerCase() === data.arbitrator.toLowerCase()) {
    errors.push("Seller and Arbitrator addresses cannot be identical");
  }

  if (!isValidAmountString(data.totalAmount)) {
    errors.push("Field 'totalAmount' must be a positive numeric string (e.g. '1000.00')");
  }

  if (!Array.isArray(data.milestones) || data.milestones.length === 0) {
    errors.push("Field 'milestones' must be a non-empty array");
  } else {
    let milestoneSum = 0;
    data.milestones.forEach((m, idx) => {
      if (typeof m.index !== "number" || m.index < 0) {
        errors.push(`Milestone[${idx}]: 'index' must be a non-negative integer`);
      }
      if (typeof m.title !== "string" || m.title.length < 2) {
        errors.push(`Milestone[${idx}]: 'title' must be at least 2 characters`);
      }
      if (!isValidAmountString(m.amount)) {
        errors.push(`Milestone[${idx}]: 'amount' must be a positive numeric string`);
      } else {
        milestoneSum += parseFloat(m.amount);
      }
      if (!isValidIsoDate(m.dueDate)) {
        errors.push(`Milestone[${idx}]: 'dueDate' must be a valid ISO-8601 date string`);
      }
    });

    if (isValidAmountString(data.totalAmount)) {
      const expectedTotal = parseFloat(data.totalAmount);
      const diff = Math.abs(milestoneSum - expectedTotal);
      if (diff > 0.000001) {
        errors.push(`Milestones sum (${milestoneSum}) does not equal totalAmount (${expectedTotal})`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a milestone deliverable submission.
 */
function validateDeliverable(data) {
  const errors = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Data must be a non-null object"] };
  }

  const required = ["version", "escrowId", "milestoneIndex", "seller", "summary", "submittedAt"];
  for (const field of required) {
    if (data[field] === undefined || data[field] === null || data[field] === "") {
      errors.push(`Missing required field: '${field}'`);
    }
  }

  if (data.version !== "1.0.0") errors.push("Invalid version: must be '1.0.0'");
  if (typeof data.escrowId !== "number" || data.escrowId < 1) errors.push("'escrowId' must be a positive integer");
  if (typeof data.milestoneIndex !== "number" || data.milestoneIndex < 0) errors.push("'milestoneIndex' must be >= 0");
  if (!isEthereumAddress(data.seller)) errors.push("'seller' must be a valid Ethereum address");
  if (typeof data.summary !== "string" || data.summary.length < 10) errors.push("'summary' must be at least 10 chars");
  if (!isValidIsoDate(data.submittedAt)) errors.push("'submittedAt' must be a valid ISO-8601 date string");

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a dispute filing.
 */
function validateDispute(data) {
  const errors = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Data must be a non-null object"] };
  }

  const required = ["version", "escrowId", "initiator", "category", "statement", "filedAt"];
  for (const field of required) {
    if (data[field] === undefined || data[field] === null || data[field] === "") {
      errors.push(`Missing required field: '${field}'`);
    }
  }

  const validCategories = [
    "NON_DELIVERY",
    "DEFECTIVE_WORK",
    "DEADLINE_BREACH",
    "SCOPE_DISAGREEMENT",
    "COMMUNICATION_BREAKDOWN",
    "OTHER",
  ];

  if (!validCategories.includes(data.category)) {
    errors.push(`Invalid category: '${data.category}'. Must be one of: ${validCategories.join(", ")}`);
  }

  if (!isEthereumAddress(data.initiator)) errors.push("'initiator' must be a valid Ethereum address");
  if (typeof data.statement !== "string" || data.statement.length < 20) {
    errors.push("'statement' must be at least 20 chars long");
  }
  if (!isValidIsoDate(data.filedAt)) errors.push("'filedAt' must be a valid ISO-8601 date string");

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = {
  isEthereumAddress,
  isValidIsoDate,
  isValidAmountString,
  validateAgreement,
  validateDeliverable,
  validateDispute,
};
