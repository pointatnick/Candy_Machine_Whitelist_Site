import styled from 'styled-components';
import { Button } from '@material-ui/core';
import { WalletDialogButton } from '@solana/wallet-adapter-material-ui';

export const MintButton = styled(Button)`
  background-color: black !important;
  color: white;
  font-family: 'Josefin Sans' !important;
  font-size: 1rem !important;
  left: 50%;
  position: absolute;
  margin-top: 2rem !important;
  -ms-transform: translateX(-50%);
  transform: translateX(-50%);
`;
export const ConnectButton = styled(WalletDialogButton)`
  background-color: black !important;
  color: white;
  font-family: 'Josefin Sans' !important;
  font-size: 1rem !important;
  left: 50%;
  position: absolute;
  margin: 0;
  -ms-transform: translateX(-50%);
  transform: translateX(-50%);
`;
