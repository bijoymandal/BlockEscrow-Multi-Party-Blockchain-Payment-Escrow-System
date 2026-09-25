function createEscrowRoutes(escrowService) {
  const router = require("express").Router();

  // GET /api/v1/escrows?role=buyer&address=0x...&status=FUNDED
  router.get("/", (req, res) => {
    const { role, address, status } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (address) filter.address = address;
    if (status) filter.status = status;

    const escrows = escrowService.listEscrows(filter);
    return res.status(200).json({ success: true, count: escrows.length, data: escrows });
  });

  // GET /api/v1/escrows/:id
  router.get("/:id", (req, res) => {
    const { id } = req.params;
    const escrow = escrowService.getEscrow(id);
    if (!escrow) {
      return res.status(404).json({ success: false, error: `Escrow #${id} not found` });
    }
    return res.status(200).json({ success: true, data: escrow });
  });

  // POST /api/v1/escrows/draft
  router.post("/draft", (req, res) => {
    try {
      const draft = escrowService.createDraftEscrow(req.body);
      return res.status(201).json({ success: true, data: draft });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message, details: err.errors || [] });
    }
  });

  return router;
}

module.exports = { createEscrowRoutes };
