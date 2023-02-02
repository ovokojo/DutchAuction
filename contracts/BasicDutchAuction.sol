// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract BasicDutchAuction is Ownable, ReentrancyGuard {
    /*
     Initialization parameters
    */
    // the minimum amount of wei that the seller is willing to accept for the item
    uint256 private _reservePrice;
    // Initial block number
    uint256 private _initialBlock;
    // the number of blockchain blocks that the auction is open for
    uint256 private _numBlocksAuctionOpen;
    // the amount of wei that the auction price should decrease by during each subsequent block.
    uint256 private _offerPriceDecrement;
    // The initial price of the item
    uint256 private _initialPrice;
    // Whether the auction is open or closed
    bool private _auctionOpen;
    /*
     Stakeholders
    */
    // the seller of the item
    address payable private _seller;
    // the winning buyer of the item
    address private _buyer;
    // List of bidders
    address payable[] public _bidders;
    // Bidders and their bid amounts
    mapping(address => uint256) public _bids;

    constructor(
        address seller,
        uint256 reservePrice,
        uint256 numBlocksAuctionOpen,
        uint256 offerPriceDecrement
    ) {
        // Set auction parameters
        _seller = payable(seller);
        _reservePrice = reservePrice;
        _numBlocksAuctionOpen = numBlocksAuctionOpen;
        _offerPriceDecrement = offerPriceDecrement;
        // Open the auction
        _auctionOpen = true;
        // Set the initial block to current block
        _initialBlock = block.number;
        // Set the initial price of the item
        _initialPrice =
            _reservePrice +
            (_numBlocksAuctionOpen * _offerPriceDecrement);
    }

    // View current price
    function getReservePrice() public view returns (uint256) {
        return _reservePrice;
    }

    // View current price
    function getNumBlocksAuctionOpen() public view returns (uint256) {
        return _numBlocksAuctionOpen;
    }

    // View number of blockchain blocks that the auction is open for
    function getOfferPriceDecrement() public view returns (uint256) {
        return _offerPriceDecrement;
    }

    // View initial price
    function getInitialPrice() public view returns (uint256) {
        return _initialPrice;
    }

    // View current price
    function getCurrentPrice() public view returns (uint256) {
        return
            _initialPrice -
            (block.number - _initialBlock) *
            _offerPriceDecrement;
    }

    // Check auction status
    function isAuctionOpen() public view returns (bool) {
        // If number of blockchain blocks has been exceeded, auction is closed
        if (
            block.number > _initialBlock + _numBlocksAuctionOpen &&
            _auctionOpen == true
        ) {
            return false;
        }
        return _auctionOpen;
    }

    function getInitialBlock() public view returns (uint256) {
        return _initialBlock;
    }

    function getCurrentBlock() public view returns (uint256) {
        return block.number;
    }

    // function to bid on the item
    function bid() public payable nonReentrant {
        // check that the auction is still open
        require(isAuctionOpen() == true, "Auction is closed!");
        // check that the bid is greater than the reserve price
        require(msg.value >= _reservePrice, "Bid is below reserve price!");
        // Add current bidder to list of bidders
        _bidders.push(payable(msg.sender));
        // if bid is greater than or equal to current price, declare winner, refund other bidders & close auction
        if (msg.value >= getCurrentPrice()) {
            // Declare winner & close auction
            _buyer = msg.sender;
            _closeAuction();
            // Send money to seller
            (bool purchaseSuccess, ) = _seller.call{value: msg.value}("");
            if (!purchaseSuccess) {
                revert();
            }
            // Refund all other bidders
            for (uint i = 0; i < _bidders.length; i++) {
                address payable bidder = _bidders[i];
                // require contract has enough money to refund
                require(
                    address(this).balance >= _bids[bidder],
                    "Not enough funds to refund bidder!"
                );
                (bool refundSuccess, ) = bidder.call{value: _bids[bidder]}("");
                if (!refundSuccess) {
                    revert();
                }
                _bids[bidder] = 0;
            }
            // Record winning bid
            _bids[msg.sender] = msg.value;
        } else {
            // Otherwise, record bid amount by bidder
            _bids[msg.sender] += msg.value;
        }
    }

    function _closeAuction() private {
        _auctionOpen = false;
    }
}
