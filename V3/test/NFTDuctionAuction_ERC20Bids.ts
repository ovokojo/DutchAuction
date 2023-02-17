import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { JsonRpcProvider } from "@ethersproject/providers";

describe("NFTDutchAuction", async function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployBasicDutchAuctionFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, firstBidder, secondBidder] = await ethers.getSigners();
    const provider = owner.provider as JsonRpcProvider; // Used ChatGPT how to connect an address to an RpcProvider
    // Deploy the NFT contract
    const DutchNFTFactory = await ethers.getContractFactory("DutchNFT");
    const dutchNFT = await DutchNFTFactory.deploy();
    // Mint NFT
    await dutchNFT.mint(owner.address);
    // Deploy the auction contract
    const basicDutchAuctionFactory = await ethers.getContractFactory("NFTDutchAuction");
    const basicDutchAuction = await basicDutchAuctionFactory.deploy(dutchNFT.address, 1, 1000000000000000n, 10n, 100000000n);
    // Set the auction contract as an approved operator for the NFT
    await dutchNFT.setApprovalForAll(basicDutchAuction.address, true);
    return { basicDutchAuction, provider, owner, dutchNFT, firstBidder, secondBidder };
  }
  /// Simulates increasing the number of blocks mined
  async function mineBlocks(provider: JsonRpcProvider, blockCount: number) {
    for (let i = 0; i < blockCount - 1; i++) {
      await provider.send('evm_mine', []);
    }
  }

  describe("Deployment", function () {
    it("creates a dutch auction", async function () {
      const { basicDutchAuction } = await loadFixture(deployBasicDutchAuctionFixture);
      const reservePrice = await basicDutchAuction.getReservePrice();
      const numBlocksAuctionOpen = await basicDutchAuction.getNumBlocksAuctionOpen();
      const offerPriceDecrement = await basicDutchAuction.getOfferPriceDecrement();
      expect(reservePrice).greaterThan(0);
      expect(numBlocksAuctionOpen).greaterThan(0);
      expect(offerPriceDecrement).greaterThan(0);
      expect(reservePrice.sub(offerPriceDecrement.mul(numBlocksAuctionOpen))).greaterThanOrEqual(0);
    });

    it("should have the right owner", async function () {
      const { basicDutchAuction, owner } = await loadFixture(deployBasicDutchAuctionFixture);
      expect(await basicDutchAuction.owner()).equal(owner.address);
    });

    it("should have the right initial price at auction open", async function () {
      const { basicDutchAuction } = await loadFixture(deployBasicDutchAuctionFixture);
      const reservePrice = await basicDutchAuction.getReservePrice();
      const numBlocksAuctionOpen = await basicDutchAuction.getNumBlocksAuctionOpen();
      const offerPriceDecrement = await basicDutchAuction.getOfferPriceDecrement();
      expect(reservePrice.add(numBlocksAuctionOpen.mul(offerPriceDecrement))).to.equal(await basicDutchAuction.getInitialPrice());
    });
  });

  describe("Auction process", function () {
    it("should be open if within the number of required blocks", async function () {
      const { basicDutchAuction, provider } = await loadFixture(deployBasicDutchAuctionFixture);
      const numBlocksAuctionOpen = await basicDutchAuction.getNumBlocksAuctionOpen();
      const initialBlock = await basicDutchAuction.getInitialBlock();
      await mineBlocks(provider, numBlocksAuctionOpen.toNumber());
      const currentBlock = await basicDutchAuction.getCurrentBlock();
      expect(initialBlock.add(numBlocksAuctionOpen)).lessThanOrEqual(currentBlock);
      const isAuctionOpen = await basicDutchAuction.isAuctionOpen();
      expect(isAuctionOpen).equal(true);
    });

    it("should have the right auction price", async function () {
      const { basicDutchAuction } = await loadFixture(deployBasicDutchAuctionFixture);
      const currentBlockNumber = await basicDutchAuction.getCurrentBlock();
      const initialBlockNumber = await basicDutchAuction.getInitialBlock();
      const offerPriceDecrement = await basicDutchAuction.getOfferPriceDecrement();
      const initialPrice = await basicDutchAuction.getInitialPrice();
      expect(initialPrice.sub(currentBlockNumber.sub(initialBlockNumber).mul(offerPriceDecrement))).to.equal(await basicDutchAuction.getCurrentPrice());
    });


    it("should record a bid below current price", async function () {
      const { basicDutchAuction, firstBidder } = await loadFixture(deployBasicDutchAuctionFixture);
      const currentPrice = await basicDutchAuction.getCurrentPrice();
      const bidAmount = currentPrice.sub(1);
      await basicDutchAuction.connect(firstBidder).bid({
        value: bidAmount,
      });
      const bidAddress = await basicDutchAuction._bidders(0)
      const bid = await basicDutchAuction._bids(bidAddress);
      expect(bidAddress).to.equal(firstBidder.address);
      expect(bid).to.equal(bidAmount);
    });

    it("should transfer the NFT to the winning bidder", async function () {
      const { basicDutchAuction, firstBidder, dutchNFT } = await loadFixture(deployBasicDutchAuctionFixture);
      const currentPrice = await basicDutchAuction.getCurrentPrice();
      const bidAmount = currentPrice.add(1n);
      await basicDutchAuction.connect(firstBidder).bid({
        value: bidAmount,
      });
      const owner = await dutchNFT.ownerOf(1);
      expect(owner).to.equal(firstBidder.address);
    });

    it("should close auction if a winning bid is placed", async function () {
      const { basicDutchAuction, firstBidder } = await loadFixture(deployBasicDutchAuctionFixture);
      const currentPrice = await basicDutchAuction.getCurrentPrice();
      const bidAmount = currentPrice.add(1n);
      await basicDutchAuction.connect(firstBidder).bid({
        value: bidAmount,
      });
      const auctionStatus = await basicDutchAuction.isAuctionOpen();
      expect(auctionStatus).to.equal(false);
    });

    it("should reject a bid if auction is closed", async function () {
      const { basicDutchAuction, provider } = await loadFixture(deployBasicDutchAuctionFixture);
      const numBlocksAuctionOpen = await basicDutchAuction.getNumBlocksAuctionOpen();
      await mineBlocks(provider, numBlocksAuctionOpen.add(1).toNumber());
      const reservePrice = await basicDutchAuction.getReservePrice();
      const auctionStatus = await basicDutchAuction.isAuctionOpen();
      expect(auctionStatus).equal(false);
      expect(basicDutchAuction.bid({ value: reservePrice.sub(1) })).to.be.reverted;
    });

    it("should reject a bid lower than the reserve price", async function () {
      const { basicDutchAuction } = await loadFixture(deployBasicDutchAuctionFixture);
      const reservePrice = await basicDutchAuction.getReservePrice();
      expect(basicDutchAuction.bid({ value: reservePrice.sub(1) })).to.be.reverted;
    });

    it("should reject a second bid", async function () {
      const { basicDutchAuction, firstBidder, secondBidder } = await loadFixture(deployBasicDutchAuctionFixture);
      const currentPrice = await basicDutchAuction.getCurrentPrice();
      expect(basicDutchAuction.connect(firstBidder).bid({
        value: currentPrice.add(1),
      })).to.be.not.reverted;
      expect(basicDutchAuction.connect(secondBidder).bid({
        value: currentPrice.add(1),
      })).to.be.reverted;
    });

    it("should refund unsuccessful bidders", async function () {
      const { basicDutchAuction, firstBidder, secondBidder, provider } = await loadFixture(deployBasicDutchAuctionFixture);
      const reservePrice = await basicDutchAuction.getReservePrice();
      const currentPrice = await basicDutchAuction.getCurrentPrice();
      const firstBidAmount = reservePrice.add(1);
      const secondBidAmount = currentPrice.add(1);
      const initialBalance = await firstBidder.getBalance();
      await basicDutchAuction.connect(firstBidder).bid({
        value: firstBidAmount,
      });
      const currentBalance = await firstBidder.getBalance();
      await basicDutchAuction.connect(secondBidder).bid({
        value: secondBidAmount,
      });
      expect(initialBalance.sub(currentBalance)).to.greaterThanOrEqual(firstBidAmount);
    });
  });
});