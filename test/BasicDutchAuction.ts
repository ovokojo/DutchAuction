import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { JsonRpcProvider } from "@ethersproject/providers";

describe("BasicDutchAuction", async function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployBasicDutchAuctionFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner] = await ethers.getSigners();
    const basicDutchAuctionFactory = await ethers.getContractFactory("BasicDutchAuction");
    const basicDutchAuction = await basicDutchAuctionFactory.deploy();
    const provider = ethers.provider as JsonRpcProvider;
    return { basicDutchAuction, owner, provider };
  }

  async function mineBlocks(provider: JsonRpcProvider, blockCount: number) {
    for (let i = 0; i < blockCount; i++) {
      await provider.send('evm_mine', []);
    }
  }

  describe("Deployment", function () {
    it("should have the right owner", async function () {
      const { basicDutchAuction, owner } = await loadFixture(deployBasicDutchAuctionFixture);
      expect(await basicDutchAuction.owner()).to.equal(owner.address);
    });

    it("should have the right reserve price", async function () {
      const { basicDutchAuction } = await loadFixture(deployBasicDutchAuctionFixture);
      const amountInWei = ethers.utils.parseUnits("0.1", "ether")
      expect(await basicDutchAuction.getReservePrice()).to.equal(amountInWei);
    });
    it("should have the right number of blockchain blocks that the auction is open for", async function () {
      const { basicDutchAuction } = await loadFixture(deployBasicDutchAuctionFixture);
      expect(await basicDutchAuction.getNumBlocksAuctionOpen()).to.equal(10);
    });

    it("should have the right price decrement after each block", async function () {
      const { basicDutchAuction } = await loadFixture(deployBasicDutchAuctionFixture);
      const amountInWei = ethers.utils.parseUnits("0.001", "ether")
      expect(await basicDutchAuction.getOfferPriceDecrement()).to.equal(amountInWei);
    });

    it("should have the right price decrement after each block", async function () {
      const { basicDutchAuction } = await loadFixture(deployBasicDutchAuctionFixture);
      const amountInWei = ethers.utils.parseUnits("0.001", "ether")
      expect(await basicDutchAuction.getOfferPriceDecrement()).to.equal(amountInWei);
    });

    it("should have the right initial price at auction open", async function () {
      const { basicDutchAuction } = await loadFixture(deployBasicDutchAuctionFixture);
      const reservePrice = await basicDutchAuction.getReservePrice();
      const numBlocksAuctionOpen = await basicDutchAuction.getNumBlocksAuctionOpen();
      const offerPriceDecrement = await basicDutchAuction.getOfferPriceDecrement();
      expect(reservePrice.add(numBlocksAuctionOpen.mul(offerPriceDecrement))).to.equal(110000000000000000n);
      expect(await basicDutchAuction.getAuctionPrice()).to.equal(110000000000000000n);
      expect(reservePrice.add(numBlocksAuctionOpen.mul(offerPriceDecrement))).to.equal(await basicDutchAuction.getAuctionPrice());
    });
  });

  describe("Auction status", function () {
    it("should be open if within the number of required blocks", async function () {
      const { basicDutchAuction, provider } = await loadFixture(deployBasicDutchAuctionFixture);
      const numBlocksAuctionOpen = await basicDutchAuction.getNumBlocksAuctionOpen();
      const currentBlock = await basicDutchAuction.getCurrentBlock();
      const initialBlock = await basicDutchAuction.getInitialBlock();
      await mineBlocks(provider, 10);
      expect(initialBlock.add(numBlocksAuctionOpen)).greaterThan(currentBlock);
      expect(await basicDutchAuction.isAuctionOpen()).to.equal(true);
    });
  });
  // TODO: Should be closed if there is a winning bid
  // TODO: Test bid
});