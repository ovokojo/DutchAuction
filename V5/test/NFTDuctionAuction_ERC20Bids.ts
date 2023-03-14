import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { JsonRpcProvider } from "@ethersproject/providers";
import { BigNumber, Contract, Signer } from "ethers";

describe("NFTDutchAuction", async function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployBasicDutchAuctionFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, firstBidder, secondBidder, thirdBidder] = await ethers.getSigners();
    const provider = owner.provider as JsonRpcProvider; // Used ChatGPT how to connect an address to an RpcProvider
    // Deploy the NFT contract
    const DutchNFTFactory = await ethers.getContractFactory("DutchNFT");
    const dutchNFT = await DutchNFTFactory.deploy();
    // Mint NFT
    await dutchNFT.mint(owner.address);
    // Deploy the DutchCoin contract
    const DutchCoinFactory = await ethers.getContractFactory("DutchCoin");
    const dutchCoin = await DutchCoinFactory.connect(owner).deploy("DutchCoin", "DTC", ethers.BigNumber.from(10).pow(18).mul(3000000));

    // Distribute some DutchCoins to the bidders
    const dutchCoinDecimals = await dutchCoin.decimals();
    await dutchCoin.connect(owner).transfer(firstBidder.address, ethers.BigNumber.from(10).pow(dutchCoinDecimals).mul(1000000));
    await dutchCoin.connect(owner).transfer(secondBidder.address, ethers.BigNumber.from(10).pow(dutchCoinDecimals).mul(1000000));
    await dutchCoin.connect(owner).transfer(thirdBidder.address, ethers.BigNumber.from(10).pow(dutchCoinDecimals).mul(1000000));

    // Deploy the auction implementation contract
    const basicDutchAuctionFactory = await ethers.getContractFactory("NFTDuctionAuction_ERC20Bids");
    const basicDutchAuctionImplementation = await basicDutchAuctionFactory.deploy();
    await basicDutchAuctionImplementation.deployed();
    // Set initializer data
    const dutchCoinAddress = dutchCoin.address;
    const dutchNFTAddress = dutchNFT.address;
    const tokenId = 1;
    const reservePrice = 1000000000000000n;
    const numBlocksAuctionOpen = 100n;
    const offerPriceDecrement = 100000000n;
    const initializeData = basicDutchAuctionImplementation.interface.encodeFunctionData("initialize", [
      dutchCoinAddress,
      dutchNFTAddress,
      tokenId,
      reservePrice,
      numBlocksAuctionOpen,
      offerPriceDecrement,
    ]);

    // Deploy ERC1967Proxy
    const ProxyFactory = await ethers.getContractFactory("ERC1967Proxy");
    const proxy = await ProxyFactory.deploy(basicDutchAuctionImplementation.address, initializeData);
    await proxy.deployed();

    // Create an instance of the NFTDutchAuction with the proxy address
    const basicDutchAuction = basicDutchAuctionFactory.attach(proxy.address);
    // Set the auction contract as an approved operator for the NFT
    await dutchNFT.setApprovalForAll(basicDutchAuction.address, true);
    // Approve the auction contract to spend tokens on behalf of the bidders
    await dutchCoin.connect(firstBidder).approve(basicDutchAuction.address, ethers.BigNumber.from(10).pow(dutchCoinDecimals).mul(1000000));
    await dutchCoin.connect(secondBidder).approve(basicDutchAuction.address, ethers.BigNumber.from(10).pow(dutchCoinDecimals).mul(1000000));

    // Deploy V2 of the auction implementation contract
    const basicDutchAuctionV2Factory = await ethers.getContractFactory("NFTDutchAuctionV2");
    const basicDutchAuctionV2Implementation = await basicDutchAuctionV2Factory.deploy();
    await basicDutchAuctionV2Implementation.deployed();
    return { basicDutchAuction, basicDutchAuctionV2Implementation, provider, owner, dutchCoin, dutchNFT, firstBidder, secondBidder, thirdBidder };
  }
  /// Simulates increasing the number of blocks mined
  async function mineBlocks(provider: JsonRpcProvider, blockCount: number) {
    for (let i = 0; i < blockCount - 1; i++) {
      await provider.send('evm_mine', []);
    }
  }

  // Helper function to sign a permit message
  // Asked ChatGPT how to sign a permit message in TypeScript
  async function signPermit(
    token: Contract,
    owner: Signer,
    spender: string,
    value: BigNumber,
    nonce: BigNumber,
    deadline: BigNumber
  ): Promise<string> {
    const name = await token.name();
    const version = "1";
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const domain = {
      name,
      version,
      chainId,
      verifyingContract: token.address,
    };

    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };

    const valueObj = {
      owner: await owner.getAddress(),
      spender: spender,
      value: value.toString(),
      nonce: nonce.toString(),
      deadline: deadline.toString(),
    };

    const typedData = JSON.stringify({
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" },
        ],
        ...types,
      },
      domain,
      primaryType: "Permit",
      message: valueObj,
    });

    const jsonRpcProvider = owner.provider as JsonRpcProvider;
    return await jsonRpcProvider.send("eth_signTypedData_v4", [await owner.getAddress(), typedData]);
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

  describe("Auction process with ERC-20", function () {
    it("should be open if within the number of required blocks", async function () {
      const { basicDutchAuction, provider } = await loadFixture(deployBasicDutchAuctionFixture);
      const numBlocksAuctionOpen = await basicDutchAuction.getNumBlocksAuctionOpen();
      const currentBlock = await basicDutchAuction.getCurrentBlock();
      const isAuctionOpen = await basicDutchAuction.isAuctionOpen();
      expect(currentBlock).lessThanOrEqual(numBlocksAuctionOpen);
      expect(isAuctionOpen).equal(true);
      await mineBlocks(provider, 100);
      const isAuctionOpenAgain = await basicDutchAuction.isAuctionOpen();
      expect(isAuctionOpenAgain).equal(false);
    });

    it("should have the right reserve price", async function () {
      const { basicDutchAuction } = await loadFixture(deployBasicDutchAuctionFixture);
      const reservePrice = await basicDutchAuction.getReservePrice();
      expect(reservePrice).to.equal(1000000000000000n);
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
      const { basicDutchAuction, firstBidder, dutchCoin } = await loadFixture(deployBasicDutchAuctionFixture);
      const currentPrice = await basicDutchAuction.getCurrentPrice();
      const bidAmount = currentPrice.sub(1);
      await dutchCoin.connect(firstBidder).approve(basicDutchAuction.address, bidAmount);
      await basicDutchAuction.connect(firstBidder).bid(bidAmount);
      const bidAddress = await basicDutchAuction._bidders(0);
      const bid = await basicDutchAuction._bids(bidAddress);
      expect(bidAddress).to.equal(firstBidder.address);
      expect(bid).to.equal(bidAmount);
    });

    it("should transfer the NFT to the winning bidder & tokens to the seller", async function () {
      const { owner, basicDutchAuction, firstBidder, dutchNFT, dutchCoin } = await loadFixture(deployBasicDutchAuctionFixture);
      const currentPrice = await basicDutchAuction.getCurrentPrice();
      const bidAmount = currentPrice.add(1);
      await dutchCoin.connect(firstBidder).approve(basicDutchAuction.address, bidAmount);
      const initialSellerBalance = await dutchCoin.balanceOf(owner.address);
      await basicDutchAuction.connect(firstBidder).bid(bidAmount);
      const buyer = await dutchNFT.ownerOf(1);
      const isAuctionOpen = await basicDutchAuction.isAuctionOpen();
      expect(buyer).to.equal(firstBidder.address);
      expect(isAuctionOpen).equal(false);
      const sellerBalance = await dutchCoin.balanceOf(owner.address);
      const expectedSellerBalance = initialSellerBalance.add(bidAmount);
      expect(sellerBalance).to.equal(expectedSellerBalance);
    });

    it("should close auction if a winning bid is placed", async function () {
      const { basicDutchAuction, firstBidder } = await loadFixture(deployBasicDutchAuctionFixture);
      const currentPrice = await basicDutchAuction.getCurrentPrice();
      const bidAmount = currentPrice.add(1n);
      await basicDutchAuction.connect(firstBidder).bid(bidAmount);
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
      expect(basicDutchAuction.bid(reservePrice.sub(1))).to.be.reverted;
    });

    it("should reject a bid lower than the reserve price", async function () {
      const { basicDutchAuction } = await loadFixture(deployBasicDutchAuctionFixture);
      const reservePrice = await basicDutchAuction.getReservePrice();
      expect(basicDutchAuction.bid(reservePrice.sub(1))).to.be.reverted;
    });

    it("should reject a second bid", async function () {
      const { basicDutchAuction, firstBidder, secondBidder } = await loadFixture(deployBasicDutchAuctionFixture);
      const currentPrice = await basicDutchAuction.getCurrentPrice();
      expect(basicDutchAuction.connect(firstBidder).bid(currentPrice.add(1))).to.be.not.reverted;
      expect(basicDutchAuction.connect(secondBidder).bid(currentPrice.add(1))).to.be.reverted;
    });

    it("should refund unsuccessful bidders", async function () {
      const { basicDutchAuction, firstBidder, secondBidder } = await loadFixture(deployBasicDutchAuctionFixture);
      const reservePrice = await basicDutchAuction.getReservePrice();
      const currentPrice = await basicDutchAuction.getCurrentPrice();
      const firstBidAmount = reservePrice.add(1);
      const secondBidAmount = currentPrice.add(1);
      await basicDutchAuction.connect(firstBidder).bid(firstBidAmount);
      const balance1 = (await basicDutchAuction._bids(firstBidder.address)).toString();
      expect(balance1).to.equal(firstBidAmount);
      await basicDutchAuction.connect(secondBidder).bid(secondBidAmount);
      const balance2 = (await basicDutchAuction._bids(secondBidder.address)).toString();
      const updatedBalance1 = (await basicDutchAuction._bids(firstBidder.address)).toString();
      expect(updatedBalance1).to.equal("0");
      expect(balance2).to.equal(secondBidAmount);
    });
  });
  describe("Upgrade Auction Contract", function () {
    it("Should upgrade the contract to V2", async function () {
      const {
        basicDutchAuction,
        basicDutchAuctionV2Implementation,
        owner,
      } = await deployBasicDutchAuctionFixture();
      // Upgrade the proxy contract to the new implementation
      await basicDutchAuction.connect(owner).upgradeTo(basicDutchAuctionV2Implementation.address);
      await basicDutchAuction.deployed();
      expect(await basicDutchAuction.getInitialVersion()).to.equal("V1");
      // Create an instance of the V2 contract with the proxy address
      const NFTDutchAuctionV2Factory = await ethers.getContractFactory("NFTDutchAuctionV2");
      const nftDutchAuctionV2 = NFTDutchAuctionV2Factory.attach(basicDutchAuction.address);
      expect(await nftDutchAuctionV2.getUpdatedVersion()).to.equal("V2");
    });
    it("Should check V2 auction is open", async function () {
      const {
        basicDutchAuction,
        basicDutchAuctionV2Implementation,
        owner,
      } = await deployBasicDutchAuctionFixture();
      await basicDutchAuction.connect(owner).upgradeTo(basicDutchAuctionV2Implementation.address);
      await basicDutchAuction.deployed();
      const NFTDutchAuctionV2Factory = await ethers.getContractFactory("NFTDutchAuctionV2");
      const nftDutchAuctionV2 = NFTDutchAuctionV2Factory.attach(basicDutchAuction.address);
      // Check auction is open
      const isAuctionOpen = await nftDutchAuctionV2.isAuctionOpen();
      expect(isAuctionOpen).equal(true);
    });
  });

  describe("ERC20Permit Functionality", function () {
    it("should record a bid using permit", async function () {
      const { basicDutchAuction, firstBidder, dutchCoin } = await loadFixture(deployBasicDutchAuctionFixture);
      const currentPrice = await basicDutchAuction.getCurrentPrice();
      const bidAmount = currentPrice.sub(1);
      const deadline = BigNumber.from(Math.floor((Date.now() / 1000) + 3600));

      // Sign permit message
      const nonce = await dutchCoin.nonces(firstBidder.address);
      const signature = await signPermit(dutchCoin, firstBidder, basicDutchAuction.address, bidAmount, nonce, deadline);
      const { v, r, s } = ethers.utils.splitSignature(signature);

      // Call permit function
      await dutchCoin.connect(firstBidder).permit(firstBidder.address, basicDutchAuction.address, bidAmount, deadline, v, r, s);

      await basicDutchAuction.connect(firstBidder).bid(bidAmount);

      const bidAddress = await basicDutchAuction._bidders(0);
      const bid = await basicDutchAuction._bids(bidAddress);
      expect(bidAddress).to.equal(firstBidder.address);
      expect(bid).to.equal(bidAmount);
    });

    it("should deny permit after the deadline", async function () {
      const { basicDutchAuction, firstBidder, dutchCoin } = await loadFixture(deployBasicDutchAuctionFixture);
      const currentPrice = await basicDutchAuction.getCurrentPrice();
      const bidAmount = currentPrice.sub(1);

      // Set a deadline 1 second in the past
      const deadline = BigNumber.from(Math.floor(Date.now() / 1000) - 1);

      const nonce = await dutchCoin.nonces(await firstBidder.getAddress());
      const signature = await signPermit(dutchCoin, firstBidder, basicDutchAuction.address, bidAmount, nonce, deadline);
      const { v, r, s } = ethers.utils.splitSignature(signature);

      // Attempt to call permit with the expired deadline
      await expect(
        dutchCoin.connect(firstBidder).permit(await firstBidder.getAddress(), basicDutchAuction.address, bidAmount, deadline, v, r, s)
      ).to.be.revertedWith("ERC20Permit: expired deadline");
    });

  });

});
