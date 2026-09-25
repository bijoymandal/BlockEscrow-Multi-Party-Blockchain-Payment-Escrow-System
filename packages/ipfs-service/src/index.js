const { PinataService } = require("./pinata.service");
const { GatewayResolver } = require("./gateway.resolver");
const validator = require("./validator");
const schemas = require("./schemas");

/**
 * Unified high-level helper: validates agreement metadata according to schema
 * and pins it to IPFS.
 */
async function validateAndPinAgreement(agreementData, options = {}) {
  const validation = validator.validateAgreement(agreementData);
  if (!validation.valid) {
    const err = new Error(`Agreement schema validation failed: ${validation.errors.join("; ")}`);
    err.validationErrors = validation.errors;
    throw err;
  }

  const pinata = new PinataService(options.pinataConfig);
  const pinResult = await pinata.pinJSONToIPFS(agreementData, {
    name: `Agreement: ${agreementData.title}`,
    keyvalues: {
      buyer: agreementData.buyer,
      seller: agreementData.seller,
      tokenSymbol: agreementData.tokenSymbol,
      totalAmount: agreementData.totalAmount,
    },
  });

  return {
    cid: pinResult.cid,
    pinSize: pinResult.pinSize,
    timestamp: pinResult.timestamp,
    isLocalFallback: pinResult.isLocalFallback,
    data: agreementData,
  };
}

/**
 * Unified high-level helper: validates milestone deliverable submission
 * and pins it to IPFS.
 */
async function validateAndPinDeliverable(deliverableData, options = {}) {
  const validation = validator.validateDeliverable(deliverableData);
  if (!validation.valid) {
    const err = new Error(`Deliverable validation failed: ${validation.errors.join("; ")}`);
    err.validationErrors = validation.errors;
    throw err;
  }

  const pinata = new PinataService(options.pinataConfig);
  const pinResult = await pinata.pinJSONToIPFS(deliverableData, {
    name: `Deliverable: Escrow #${deliverableData.escrowId} M#${deliverableData.milestoneIndex}`,
    keyvalues: {
      escrowId: String(deliverableData.escrowId),
      milestoneIndex: String(deliverableData.milestoneIndex),
      seller: deliverableData.seller,
    },
  });

  return {
    cid: pinResult.cid,
    pinSize: pinResult.pinSize,
    timestamp: pinResult.timestamp,
    isLocalFallback: pinResult.isLocalFallback,
    data: deliverableData,
  };
}

/**
 * Unified high-level helper: validates dispute filing and pins to IPFS.
 */
async function validateAndPinDispute(disputeData, options = {}) {
  const validation = validator.validateDispute(disputeData);
  if (!validation.valid) {
    const err = new Error(`Dispute validation failed: ${validation.errors.join("; ")}`);
    err.validationErrors = validation.errors;
    throw err;
  }

  const pinata = new PinataService(options.pinataConfig);
  const pinResult = await pinata.pinJSONToIPFS(disputeData, {
    name: `Dispute: Escrow #${disputeData.escrowId} by ${disputeData.initiator.slice(0, 8)}`,
    keyvalues: {
      escrowId: String(disputeData.escrowId),
      category: disputeData.category,
      initiator: disputeData.initiator,
    },
  });

  return {
    cid: pinResult.cid,
    pinSize: pinResult.pinSize,
    timestamp: pinResult.timestamp,
    isLocalFallback: pinResult.isLocalFallback,
    data: disputeData,
  };
}

module.exports = {
  PinataService,
  GatewayResolver,
  validator,
  schemas,
  validateAndPinAgreement,
  validateAndPinDeliverable,
  validateAndPinDispute,
};
