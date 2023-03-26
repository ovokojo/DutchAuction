import { useWeb3React } from '@web3-react/core';
import { Contract, ethers, Signer } from 'ethers';
import {
    ChangeEvent,
    MouseEvent,
    ReactElement,
    useEffect,
    useState
} from 'react';
import styled from 'styled-components';
import BasicDutchAuctionArtifact from '../artifacts/contracts/BasicDutchAuction.sol/BasicDutchAuction.json';
import { Provider } from '../utils/provider';

const StyledInput = styled.input`
  padding: 0.4rem 0.6rem;
  line-height: 2fr;
`;

const StyledLabel = styled.label`
  font-weight: bold;
`;

const StyledButton = styled.button`
  width: 150px;
  height: 2rem;
  border-radius: 1rem;
  border-color: blue;
  cursor: pointer;
`;

const SectionTitle = styled.h2`
  margin-bottom: 1rem;
`;

export function BasicDutchAuction(): ReactElement {
    const context = useWeb3React<Provider>();
    const { library, active } = context;

    const [signer, setSigner] = useState<Signer>();
    const [auctionContractAddr, setAuctionContractAddr] = useState<string>('');
    const [auctionContract, setAuctionContract] = useState<Contract>();

    // Section 1 states
    const [seller, setSeller] = useState<string>('');
    const [reservePrice, setReservePrice] = useState<string>('');
    const [numBlocksAuctionOpen, setNumBlocksAuctionOpen] = useState<string>('');
    const [offerPriceDecrement, setOfferPriceDecrement] = useState<string>('');

    // Section 2 states
    const [lookupAddress, setLookupAddress] = useState<string>('');
    const [auctionInfo, setAuctionInfo] = useState<string>('');

    // Section 3 states
    const [bidAddress, setBidAddress] = useState<string>('');
    const [bidAmount, setBidAmount] = useState<string>('');
    const [bidResult, setBidResult] = useState<string>('');

    useEffect(() => {
        if (!library) {
            setSigner(undefined);
            return;
        }
        setSigner(library.getSigner());
    }, [library]);

    async function deployAuction() {
        if (!signer) return;
        const auctionFactory = new ethers.ContractFactory(
            BasicDutchAuctionArtifact.abi,
            BasicDutchAuctionArtifact.bytecode,
            signer
        );

        try {
            const reservePriceInWei = ethers.utils.parseEther(reservePrice);
            const offerPriceDecrementinWei = ethers.utils.parseEther(offerPriceDecrement);
            const auction = await auctionFactory.deploy(
                seller,
                reservePriceInWei,
                numBlocksAuctionOpen,
                offerPriceDecrementinWei
            );
            await auction.deployed();
            console.log('Deployed contract address:', auction.address);
            setAuctionContract(auction);
            setAuctionContractAddr(auction.address);
        } catch (error: any) {
            console.error('Error deploying contract:', error);
        }
    }

    async function showAuctionInfo() {
        if (!library || !lookupAddress) return;
        try {
            const auction = new ethers.Contract(
                lookupAddress,
                BasicDutchAuctionArtifact.abi,
                library
            );
            const seller = await auction.getSeller();
            const reservePrice = ethers.utils.formatEther(await auction.getReservePrice());
            const numBlocksAuctionOpen = await auction.getNumBlocksAuctionOpen();
            const offerPriceDecrement = ethers.utils.formatEther(await auction.getOfferPriceDecrement());
            const initialPrice = ethers.utils.formatEther(await auction.getInitialPrice());
            const currentPrice = ethers.utils.formatEther(await auction.getCurrentPrice());
            const winner = await auction.getWinner();

            const auctionInfo = `
                Seller: ${seller}
                Reserve Price: ${reservePrice} ETH
                Number of Blocks Auction Open: ${numBlocksAuctionOpen}
                Offer Price Decrement: ${offerPriceDecrement} ETH
                Initial Price: ${initialPrice} ETH
                Current Price: ${currentPrice} ETH
                Winner: ${winner == '0x0000000000000000000000000000000000000000' ? 'None' : winner}
              `;
            setAuctionInfo(auctionInfo);
        } catch (error: any) {
            console.error('Error getting auction info:', error);
        }
    }

    async function submitBid() {
        if (!signer || !bidAddress || !bidAmount) return;
        try {
            setBidResult(''); // Reset bid result
            const auction = new ethers.Contract(
                bidAddress,
                BasicDutchAuctionArtifact.abi,
                signer
            );

            const ended = await auction.ended();
            if (ended) {
                setBidResult('Auction has already ended.');
                return;
            }

            const currentPrice = await auction.getCurrentPrice();
            const bidInWei = ethers.utils.parseEther(bidAmount);
            if (bidInWei.lt(currentPrice)) {
                setBidResult(`Bid must be greater than or equal to the current price: ${ethers.utils.formatEther(currentPrice)} ETH`);
                return;
            }

            const tx = await auction.bid({ value: bidInWei });
            await tx.wait();

            // Check if the auction has a winner after submitting the bid
            const winner = await auction.winner();
            if (winner !== ethers.constants.AddressZero) {
                setBidResult(`Bid submitted successfully! The auction was won by ${winner}`);
            } else {
                setBidResult('Bid submitted successfully!');
            }
        } catch (error: any) {
            console.error('Error submitting bid:', error);
            setBidResult('Bid submission failed.');
        }
    }


    return (
        <div>
            <SectionTitle>🚀 Deployment</SectionTitle>
            <div>
                <StyledLabel>Seller: </StyledLabel>
                <StyledInput
                    type="text"
                    value={seller}
                    onChange={(e) => setSeller(e.target.value)}
                />
            </div>
            <br></br>
            <div>
                <StyledLabel>Reserve Price: </StyledLabel>
                <StyledInput
                    type="text"
                    value={reservePrice}
                    onChange={(e) => setReservePrice(e.target.value)}
                />
            </div>
            <br></br>
            <div>
                <StyledLabel>Number of Blocks Auction Open: </StyledLabel>
                <StyledInput
                    type="text"
                    value={numBlocksAuctionOpen}
                    onChange={(e) => setNumBlocksAuctionOpen(e.target.value)}
                />
            </div>
            <br></br>
            <div>
                <StyledLabel>Offer Price Decrement: </StyledLabel>
                <StyledInput
                    type="text"
                    value={offerPriceDecrement}
                    onChange={(e) => setOfferPriceDecrement(e.target.value)}
                />
            </div>
            <br></br>
            <StyledButton onClick={deployAuction}>Deploy</StyledButton>
            {auctionContractAddr && <div>Auction Address: {auctionContractAddr}</div>}
            <hr />
            <SectionTitle>📜 Auction Info</SectionTitle>
            <div>
                <StyledLabel>Auction Address: </StyledLabel>
                <StyledInput
                    type="text"
                    value={lookupAddress}
                    onChange={(e) => setLookupAddress(e.target.value)}
                />
            </div>
            <br></br>
            <StyledButton onClick={showAuctionInfo}>Show Info</StyledButton>
            {auctionInfo && <pre>{auctionInfo}</pre>}
            <hr />
            <SectionTitle>💸 Submit a Bid</SectionTitle>
            <div>
                <StyledLabel>Auction Address:</StyledLabel>
                <StyledInput
                    type="text"
                    value={bidAddress}
                    onChange={(e) => setBidAddress(e.target.value)}
                />
            </div>
            <br></br>
            <div>
                <StyledLabel>Bid Amount:</StyledLabel>
                <StyledInput
                    type="text"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                />
            </div>
            <br></br>
            <StyledButton onClick={submitBid}>Bid</StyledButton>
            {bidResult && <div>{bidResult}</div>}
        </div>
    );
}