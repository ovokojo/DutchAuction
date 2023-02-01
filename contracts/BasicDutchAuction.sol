// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/access/Ownable.sol";

contract BasicDutchAuction is Ownable {
    /*
     Initialization parameters
    */
    // the minimum amount of wei that the seller is willing to accept for the item
    uint256 private reservePrice = 0.1 ether;
    // the number of blockchain blocks that the auction is open for
    uint256 private numBlocksAuctionOpen = 10;
    // the amount of wei that the auction price should decrease by during each subsequent block.
    uint256 private offerPriceDecrement = 0.001 ether;
    // The current price of the item
    uint256 private auctionPrice;
    // Whether the auction is open or closed
    bool private auctionOpen;
    /*
     Stakeholders
    */
    // the seller of the item
    address private seller;
    // the winning buyer of the item
    address private buyer;
    // List of bidders
    address payable[] public bidders;
    // Bidders and their bid amounts
    mapping(address => uint256) public bids;

    constructor() {
        // Open the auction
        auctionOpen = true;
        // Set the initial price of the item
        auctionPrice =
            reservePrice +
            (numBlocksAuctionOpen * offerPriceDecrement);
    }

    // View current price
    function getReservePrice() public view returns (uint256) {
        return reservePrice;
    }

    // View current price
    function getNumBlocksAuctionOpen() public view returns (uint256) {
        return numBlocksAuctionOpen;
    }

    // View number of blockchain blocks that the auction is open for
    function getOfferPriceDecrement() public view returns (uint256) {
        return offerPriceDecrement;
    }

    // View current price
    function getAuctionPrice() public view returns (uint256) {
        return auctionPrice;
    }

    // View auction status
    function getAuctionStatus() public view returns (bool) {
        return auctionOpen;
    }

    // function to bid on the item
    function bid() public payable {
        // check that the auction is still open
        require(
            block.number < numBlocksAuctionOpen || auctionOpen,
            "Auction is closed!"
        );
        // check that the bid is greater than the current price
        require(msg.value >= reservePrice, "Bid is below reserve price");
        bidders.push(payable(msg.sender));
        if (msg.value >= auctionPrice) {
            // Declare auction winner
            declareWinner(msg.sender);
            // Refund all other bidders
            for (uint i = 0; i < bidders.length; i++) {
                address payable bidder = bidders[i];
                bidder.transfer(bids[bidder]);
                bids[bidder] = 0;
            }
            // Record winning bid amount & address
            bids[msg.sender] = msg.value;
        } else {
            // Record bid amount & bidder address
            bids[msg.sender] += msg.value;
        }
    }

    function declareWinner(address winner) private {
        buyer = winner;
        auctionOpen = false;
    }
}
