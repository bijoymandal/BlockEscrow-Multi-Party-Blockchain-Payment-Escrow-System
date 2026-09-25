const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("==================================================");
  console.log("BlockEscrow Protocol - Deployment");
  console.log("==================================================");
  console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Deployer Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH/MATIC`);

  const treasuryAddress = process.env.TREASURY_ADDRESS || deployer.address;
  const protocolFeeBps = parseInt(process.env.PROTOCOL_FEE_BPS || "50", 10); // 0.50%

  console.log(`Treasury Address: ${treasuryAddress}`);
  console.log(`Protocol Fee: ${protocolFeeBps / 100}% (${protocolFeeBps} bps)`);

  console.log("\nDeploying BlockEscrow UUPS Proxy...");
  const BlockEscrowFactory = await ethers.getContractFactory("BlockEscrow");
  const blockEscrow = await upgrades.deployProxy(
    BlockEscrowFactory,
    [deployer.address, treasuryAddress, protocolFeeBps],
    { kind: "uups" }
  );

  await blockEscrow.waitForDeployment();
  const proxyAddress = await blockEscrow.getAddress();
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log(`\n✔ BlockEscrow Proxy deployed to: ${proxyAddress}`);
  console.log(`✔ Implementation deployed to:   ${implementationAddress}`);
  console.log("==================================================");

  console.log("\nNext Steps for Verification:");
  console.log(`npx hardhat verify --network ${network.name} ${implementationAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
