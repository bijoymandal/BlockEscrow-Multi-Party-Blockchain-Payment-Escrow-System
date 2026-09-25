const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Multi-Chain Deployment & Verification Automation (OPS-602)
 * Targets: Polygon PoS (137), Arbitrum One (42161), Sepolia (11155111)
 */
async function deployToChain(targetNetworkName = null) {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const netName = targetNetworkName || network.name;

  console.log(`\n==================================================`);
  console.log(`🚀 BlockEscrow Multi-Chain Deployment Pipeline`);
  console.log(`🌐 Network:  ${netName} (Chain ID: ${chainId})`);
  console.log(`🔑 Deployer: ${deployer.address}`);
  console.log(`==================================================`);

  const treasuryAddress = process.env.TREASURY_ADDRESS || process.env.SAFE_MULTISIG_ADDRESS || deployer.address;
  const protocolFeeBps = parseInt(process.env.PROTOCOL_FEE_BPS || "50", 10); // 0.50%

  console.log(`Treasury Address: ${treasuryAddress}`);
  console.log(`Protocol Fee:     ${protocolFeeBps / 100}% (${protocolFeeBps} bps)`);

  // 1. Deploy Implementation & UUPS Proxy
  console.log(`\nDeploying BlockEscrow UUPS Proxy on ${netName}...`);
  const BlockEscrowFactory = await ethers.getContractFactory("BlockEscrow");
  const blockEscrow = await upgrades.deployProxy(
    BlockEscrowFactory,
    [deployer.address, treasuryAddress, protocolFeeBps],
    { kind: "uups" }
  );

  await blockEscrow.waitForDeployment();
  const proxyAddress = await blockEscrow.getAddress();
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log(`✔ Proxy Deployed:          ${proxyAddress}`);
  console.log(`✔ Implementation Deployed: ${implementationAddress}`);

  // 2. Transfer Ownership to Multi-Sig if configured
  const multiSigAddress = process.env.SAFE_MULTISIG_ADDRESS;
  if (multiSigAddress && ethers.isAddress(multiSigAddress) && multiSigAddress.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log(`\nTransferring Proxy Ownership to Multi-Sig Safe: ${multiSigAddress}...`);
    const tx = await blockEscrow.transferOwnership(multiSigAddress);
    await tx.wait();
    console.log(`✔ Ownership transferred to Multi-Sig Safe!`);
  }

  // 3. Save Deployment Manifest
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const manifest = {
    network: netName,
    chainId,
    proxyAddress,
    implementationAddress,
    treasuryAddress,
    protocolFeeBps,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    verificationCmd: `npx hardhat verify --network ${netName} ${implementationAddress}`,
  };

  const manifestPath = path.join(deploymentsDir, `${netName}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`✔ Deployment record written to: ${manifestPath}`);

  return manifest;
}

if (require.main === module) {
  deployToChain()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Multi-chain deployment failed:", err);
      process.exit(1);
    });
}

module.exports = { deployToChain };
