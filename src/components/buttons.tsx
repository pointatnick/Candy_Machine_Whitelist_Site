import styled from 'styled-components';
import { Button } from '@material-ui/core';
import { WalletDialogButton } from '@solana/wallet-adapter-material-ui';

export const MintButton = styled(Button)`
  background-color: black !important;
  color: white;
`;
export const ConnectButton = styled(WalletDialogButton)`
  background-color: black !important;
  color: white;
`;
