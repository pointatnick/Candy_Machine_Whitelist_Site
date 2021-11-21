import { useEffect, useState } from 'react';
import styled from 'styled-components';
import Countdown from 'react-countdown';
import { CircularProgress, Snackbar } from '@material-ui/core';
import Alert from '@material-ui/lab/Alert';
import * as anchor from '@project-serum/anchor';
import { useAnchorWallet } from '@solana/wallet-adapter-react';

import {
  CandyMachine,
  awaitTransactionSignatureConfirmation,
  getCandyMachineState,
  mintOneToken,
  shortenAddress,
} from './candy-machine';

import {
  MainContainer,
  DisplayContainer,
  InfoContainer,
  MintContainer,
  MintButton,
  ConnectButton,
} from './components';

const CounterText = styled.span``; // add your styles here
const DisplayImage = styled.img`
  min-width: 240px;
  max-width: 100%;
  border-radius: 1em;
  place-self: center;
`;
const Header = styled.div`
  font-size: 2rem;
  font-family: 'Josefin Sans';
  margin-bottom: 1rem;
  margin-left: 2.5rem;
`;
const Text = styled.div`
  font-size: 1.5rem;
  font-family: 'Cormorant';
`;
const MintText = styled(Text)`
  font-size: 2rem;
  margin-left: 6rem;
  margin-right: 6rem;
  font-family: monospace;
`;
const Title = styled.div`
  margin-top: 3rem;
  margin-bottom: 3rem;
  font-size: 4.5rem;
  line-height: 1;
  text-align: center;
  font-family: 'Josefin Sans';
  text-transform: uppercase;
`;
const SolanaBanner = styled.div`
  background: rgb(255, 0, 255);
  background: linear-gradient(
    90deg,
    rgba(255, 0, 255, 1) 0%,
    rgba(0, 255, 255, 1) 100%
  );
  padding-bottom: 0.75rem;
`;

export interface HomeProps {
  candyMachineId: anchor.web3.PublicKey;
  config: anchor.web3.PublicKey;
  connection: anchor.web3.Connection;
  startDate: number;
  treasury: anchor.web3.PublicKey;
  txTimeout: number;
  apiUrl: string;
}

const Home = (props: HomeProps) => {
  const [isActive, setIsActive] = useState(false); // true when countdown completes
  const [isSoldOut, setIsSoldOut] = useState(false); // true when items remaining is zero
  const [isMinting, setIsMinting] = useState(false); // true when user got to press MINT
  const [isWhitelisted, setWhitelisted] = useState(false);

  const [itemsAvailable, setItemsAvailable] = useState(0);
  const [itemsRedeemed, setItemsRedeemed] = useState(0);

  const [alertState, setAlertState] = useState<AlertState>({
    open: false,
    message: '',
    severity: undefined,
  });

  const [startDate, setStartDate] = useState(new Date(props.startDate));

  const wallet = useAnchorWallet();
  const [candyMachine, setCandyMachine] = useState<CandyMachine>();
  const refreshCandyMachineState = () => {
    (async () => {
      if (!wallet) return;

      const {
        candyMachine,
        goLiveDate,
        itemsAvailable,
        itemsRemaining,
        itemsRedeemed,
      } = await getCandyMachineState(
        wallet as anchor.Wallet,
        props.candyMachineId,
        props.connection
      );

      setItemsAvailable(itemsAvailable);
      console.log(itemsRemaining);
      setItemsRedeemed(itemsRedeemed);

      setIsSoldOut(itemsRemaining === 0);
      setStartDate(goLiveDate);
      setCandyMachine(candyMachine);
    })();
  };

  const writeCookie = () => {
    // cookie should be the wallet pubkey in case someone has more than one wallet per discord acct for whatever reason
    document.cookie = 'PeOjOfsDWGWq5LKWfSss=1'; // use a dummy string so no one looks
  };
  const getLocalTimesMinted = () => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; PeOjOfsDWGWq5LKWfSss=`);
    const kvPair = parts.pop(); //; PeOjOfsDWGWq5LKWfSss=1
    if (kvPair) {
      return parseInt(kvPair.split(';').shift()!);
    } else {
      return 0;
    }
  };

  const onMint = async () => {
    try {
      if (getLocalTimesMinted() >= 1) {
        throw new Error('Not enough reserves');
      }

      let res = await fetch(
        `${props.apiUrl}/whitelisted/member/${(
          wallet as anchor.Wallet
        ).publicKey.toString()}`,
        { method: 'GET' }
      );
      const res_json = await res.json();
      const res_num = await JSON.parse(JSON.stringify(res_json)).reserve; //The number  of reserves the user has left
      if (!isWhitelisted) {
        throw new Error('You are not whitelisted');
      }
      if (res_num - 1 < 0) {
        throw new Error('Not enough reserves');
      }
      setIsMinting(true);
      if (wallet && candyMachine?.program) {
        writeCookie();

        const mintTxId = await mintOneToken(
          candyMachine,
          props.config,
          wallet.publicKey,
          props.treasury
        );

        const status = await awaitTransactionSignatureConfirmation(
          mintTxId,
          props.txTimeout,
          props.connection,
          'singleGossip',
          false
        );

        if (!status?.err) {
          setAlertState({
            open: true,
            message: 'Congratulations! Mint succeeded!',
            severity: 'success',
          });
          const to_send = await JSON.stringify({ reserve: res_num - 1 });
          await fetch(
            `${props.apiUrl}/whitelisted/update/${(
              wallet as anchor.Wallet
            ).publicKey.toString()}/${process.env.REACT_APP_SECRET_KEY}`,
            {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: to_send,
            }
          );
          console.log('Updated Reserves for user');
        } else {
          setAlertState({
            open: true,
            message: 'Mint failed! Please try again!',
            severity: 'error',
          });
        }
      }
    } catch (error: any) {
      // TODO: blech:
      let message = error.message || 'Minting failed! Please try again!';
      if (!error.message) {
        if (error.message.indexOf('0x138')) {
        } else if (error.message.indexOf('0x137')) {
          message = `SOLD OUT!`;
        } else if (error.message.indexOf('0x135')) {
          message = `Insufficient funds to mint. Please fund your wallet.`;
        }
      } else {
        if (error.code === 311) {
          message = `SOLD OUT!`;
          setIsSoldOut(true);
        } else if (error.code === 312) {
          message = `Minting period hasn't started yet.`;
        } else if (error.message === 'You are not whitelisted') {
          message = error.message;
        } else if (error.message === 'Not enough reserves') {
          message = error.message;
        }
      }

      setAlertState({
        open: true,
        message,
        severity: 'error',
      });
    } finally {
      setIsMinting(false);
      refreshCandyMachineState();
    }
  };

  useEffect(() => {
    (async () => {
      if (wallet) {
        const data = await fetch(
          `${props.apiUrl}/whitelisted/member/${(
            wallet as anchor.Wallet
          ).publicKey.toString()}`
        );
        if (data.status.toString() !== '404') {
          setWhitelisted(true);
        } else {
          console.log('not found');
        }
      }
    })();
  }, [props.apiUrl, wallet, props.connection]);

  useEffect(refreshCandyMachineState, [
    wallet,
    props.candyMachineId,
    props.connection,
  ]);

  return (
    <main>
      <SolanaBanner></SolanaBanner>
      <Title>fancy diamonds</Title>
      <MainContainer>
        <DisplayContainer>
          <DisplayImage
            src="./diamonds.gif"
            alt="Diamonds on display"
          ></DisplayImage>
        </DisplayContainer>
        <MintContainer>
          <MintText>
            {wallet && (
              <p>Wallet: {shortenAddress(wallet.publicKey.toBase58() || '')}</p>
            )}
            {wallet && <p>Cost: 0.5 SOL</p>}
            {wallet && (
              <p>
                {itemsRedeemed} / {itemsAvailable} minted
              </p>
            )}
          </MintText>

          {!wallet ? (
            <ConnectButton>connect wallet</ConnectButton>
          ) : (
            <MintButton
              disabled={!isWhitelisted || isSoldOut || isMinting || !isActive} //change happened here
              onClick={onMint}
              variant="contained"
            >
              {isSoldOut ? (
                'SOLD OUT'
              ) : isActive ? (
                isMinting ? (
                  <CircularProgress />
                ) : (
                  'mint'
                )
              ) : (
                <Countdown
                  date={startDate}
                  onMount={({ completed }) => completed && setIsActive(true)}
                  onComplete={() => setIsActive(true)}
                  renderer={renderCounter}
                />
              )}
            </MintButton>
          )}
        </MintContainer>
        <InfoContainer>
          <div>
            <Header>mint instructions</Header>
            <Text>
              <ol>
                <li>click "connect wallet".</li>
                <li>select the wallet you want to use.</li>
                <li>
                  when it's time to mint, hit the button!
                  <br />
                  your diamond will show up in your wallet 💎
                </li>
              </ol>
            </Text>
          </div>
        </InfoContainer>
        <Snackbar
          open={alertState.open}
          autoHideDuration={6000}
          onClose={() => setAlertState({ ...alertState, open: false })}
        >
          <Alert
            onClose={() => setAlertState({ ...alertState, open: false })}
            severity={alertState.severity}
          >
            {alertState.message}
          </Alert>
        </Snackbar>
      </MainContainer>
    </main>
  );
};

interface AlertState {
  open: boolean;
  message: string;
  severity: 'success' | 'info' | 'warning' | 'error' | undefined;
}

const renderCounter = ({ days, hours, minutes, seconds, completed }: any) => {
  return (
    <CounterText>
      {hours + (days || 0) * 24} hours, {minutes} minutes, {seconds} seconds
    </CounterText>
  );
};

export default Home;
