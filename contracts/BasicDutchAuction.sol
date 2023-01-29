// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract BasicDutchAuction {
    // the minimum amount of wei that the seller is willing to accept for the item
    uint256 private reservePrice = 100;
    // the number of blockchain blocks that the auction is open for
    uint256 private numBlocksAuctionOpen = 10;
    // the amount of wei that the auction price should decrease by during each subsequent block.
    uint256 private offerPriceDecrement = 1;
    // The current price of the item
    uint256 private currentPrice;

    constructor() {
        // Set the initial price of the item
        currentPrice =
            reservePrice +
            numBlocksAuctionOpen *
            offerPriceDecrement;
    }

    // function to bid on the item
    function bid() public payable {
        // check that the auction is still open
        require(block.number < numBlocksAuctionOpen, "Auction is closed");
        // check that the bid is greater than the current price
        require(
            msg.value > currentPrice,
            "Bid must be greater than current price"
        );
        // calculate the new price
        currentPrice = currentPrice - offerPriceDecrement;
    }

    // function to view current price
    function getCurrentPrice() public view returns (uint256) {
        return currentPrice;
    }
}
