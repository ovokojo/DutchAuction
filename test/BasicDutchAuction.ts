import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("BasicDutchAuction", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployBasicDutchAuctionFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner] = await ethers.getSigners();
    const basicDutchAuctionFactory = await ethers.getContractFactory("BasicDutchAuction");
    const basicDutchAuction = await basicDutchAuctionFactory.deploy();

    return { basicDutchAuction, owner };
  }

  describe("Deployment", function () {
    it("Current price should be equal to 110", async function () {
      const { basicDutchAuction } = await loadFixture(deployBasicDutchAuctionFixture);
      expect(await basicDutchAuction.getCurrentPrice()).to.equal(110);
    });
  });
});