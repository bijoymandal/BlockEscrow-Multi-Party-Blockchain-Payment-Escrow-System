const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { Web3WalletState, EscrowContractClient, SIWEService } = require("../src/index");

describe("Phase 4: Web3 Hooks & Clients Test Suite", () => {
  describe("Web3WalletState Hook Manager", () => {
    test("initializes disconnected by default", () => {
      const wallet = new Web3WalletState();
      const state = wallet.getState();
      assert.equal(state.isConnected, false);
      assert.equal(state.address, null);
      assert.equal(state.chainId, null);
    });

    test("connects successfully with mock provider", async () => {
      const mockProvider = {
        request: async ({ method, params }) => {
          if (method === "eth_requestAccounts") {
            return ["0x70997970c51812dc3a010c7d01b50e0d17dc79c8"];
          }
          if (method === "eth_chainId") {
            return "0x89"; // 137 in hex (Polygon)
          }
          if (method === "eth_getBalance") {
            return "0x1bc16d674ec80000"; // 2 ETH in wei
          }
          return null;
        },
        on: () => {},
        removeListener: () => {},
      };

      const wallet = new Web3WalletState({ provider: mockProvider });
      const connected = await wallet.connect();

      assert.equal(connected.isConnected, true);
      assert.equal(connected.address, "0x70997970c51812dc3a010c7d01b50e0d17dc79c8");
      assert.equal(connected.chainId, 137);
      assert.equal(connected.balanceEth, "2.0000");
    });

    test("handles account and chain change events", async () => {
      let registeredListeners = {};
      const mockProvider = {
        request: async ({ method }) => {
          if (method === "eth_requestAccounts") return ["0xaaa"];
          if (method === "eth_chainId") return "0x1";
          if (method === "eth_getBalance") return "0x0";
          return null;
        },
        on: (event, handler) => {
          registeredListeners[event] = handler;
        },
        removeListener: (event) => {
          delete registeredListeners[event];
        },
      };

      const wallet = new Web3WalletState({ provider: mockProvider });
      await wallet.connect();

      // Trigger accountsChanged
      registeredListeners["accountsChanged"](["0xbbb"]);
      assert.equal(wallet.getState().address, "0xbbb");

      // Trigger chainChanged
      registeredListeners["chainChanged"]("0x89"); // 137
      assert.equal(wallet.getState().chainId, 137);

      // Trigger disconnect
      wallet.disconnect();
      assert.equal(wallet.getState().isConnected, false);
      assert.equal(wallet.getState().address, null);
    });
  });

  describe("EscrowContractClient", () => {
    const dummyContractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
    const dummyBuyer = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const dummySeller = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
    const dummyArbitrator = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";

    test("validates createEscrow parameters strictly", async () => {
      const client = new EscrowContractClient({
        contractAddress: dummyContractAddress,
        provider: { getSigner: () => ({ getAddress: async () => dummyBuyer }) },
      });

      // Missing buyer
      await assert.rejects(
        () =>
          client.createEscrow({
            seller: dummySeller,
            arbitrator: dummyArbitrator,
            amount: "1.0",
            milestonePercentages: [10000],
            ipfsHash: "QmSample",
          }),
        /Valid buyer address required/
      );

      // Percentage sum mismatch
      await assert.rejects(
        () =>
          client.createEscrow({
            buyer: dummyBuyer,
            seller: dummySeller,
            arbitrator: dummyArbitrator,
            amount: "1.0",
            milestonePercentages: [5000, 4000], // 90% != 100%
            ipfsHash: "QmSample",
          }),
        /Milestone percentages must sum to 10,000 basis points/
      );
    });

    test("validates resolveDispute split percentages", async () => {
      const client = new EscrowContractClient({
        contractAddress: dummyContractAddress,
      });

      await assert.rejects(
        () =>
          client.resolveDispute({
            escrowId: 1,
            buyerSplitBps: 4000,
            sellerSplitBps: 5000, // 9000 != 10000
          }),
        /Split basis points must equal 10,000/
      );
    });
  });

  describe("SIWEService", () => {
    test("formats standard EIP-4361 compliant message", () => {
      const siwe = new SIWEService({ domain: "blockescrow.eth", uri: "https://blockescrow.eth" });
      const msg = siwe.createMessage({
        address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        chainId: 137,
        nonce: "abcdef1234567890abcdef1234567890",
        issuedAt: "2026-09-25T12:00:00.000Z",
      });

      assert.ok(msg.includes("blockescrow.eth wants you to sign in with your Ethereum account:"));
      assert.ok(msg.includes("Chain ID: 137"));
      assert.ok(msg.includes("Nonce: abcdef1234567890abcdef1234567890"));
    });

    test("executes end-to-end signIn flow with mock verifier", async () => {
      const siwe = new SIWEService();
      const mockAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

      const mockNonce = "mock_nonce_12345";
      const mockFetchNonce = async (addr) => mockNonce;
      const mockSignMessage = async (msg) => "0xmockSignature";
      const mockVerify = async ({ message, signature, address }) => {
        assert.ok(message.includes(mockNonce));
        assert.equal(signature, "0xmockSignature");
        return {
          token: "mock_jwt_token_header.payload.signature",
          user: { address, chainId: 137, role: "BUYER" },
        };
      };

      const result = await siwe.signIn({
        address: mockAddress,
        chainId: 137,
        signMessageFn: mockSignMessage,
        fetchNonceFn: mockFetchNonce,
        verifyFn: mockVerify,
      });

      assert.ok(result.token);
      assert.equal(siwe.getState().isAuthenticated, true);
      assert.equal(siwe.getState().user.address, mockAddress);

      // Sign out
      siwe.signOut();
      assert.equal(siwe.getState().isAuthenticated, false);
      assert.equal(siwe.getState().token, null);
    });
  });
});
