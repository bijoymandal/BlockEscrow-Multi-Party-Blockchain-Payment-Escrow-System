/**
 * BlockEscrow Frontend Component & Web3 SDK Library
 */

const { theme } = require("./config/theme.tokens");
const { SUPPORTED_CHAINS, isSupportedChain, getChainConfig } = require("./config/chains");
const { renderStatusBadge } = require("./components/ui/StatusBadge");
const { renderButton } = require("./components/ui/Button");
const { renderMilestoneStepper } = require("./components/escrow/MilestoneStepper");
const { renderArbitrationConsole } = require("./components/escrow/ArbitrationConsole");
const { renderEscrowCard } = require("./components/escrow/EscrowCard");
const { renderWalletConnectButton } = require("./components/web3/WalletConnectButton");
const { renderNetworkSwitchBanner } = require("./components/web3/NetworkSwitchBanner");
const { Web3WalletState } = require("./hooks/useWeb3Wallet");
const { EscrowContractClient } = require("./hooks/useEscrowContract");
const { SIWEService } = require("./hooks/useSIWE");
const { CreateEscrowWizard } = require("./views/CreateEscrowWizard");
const { renderDashboardView } = require("./views/DashboardView");

module.exports = {
  theme,
  SUPPORTED_CHAINS,
  isSupportedChain,
  getChainConfig,
  renderStatusBadge,
  renderButton,
  renderMilestoneStepper,
  renderArbitrationConsole,
  renderEscrowCard,
  renderWalletConnectButton,
  renderNetworkSwitchBanner,
  Web3WalletState,
  EscrowContractClient,
  SIWEService,
  CreateEscrowWizard,
  renderDashboardView,
};
