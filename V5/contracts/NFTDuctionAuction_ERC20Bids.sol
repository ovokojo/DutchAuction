// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract NFTDuctionAuction_ERC20Bids is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    /*
     Initialization parameters
    */
    // The NFT being auctioned
    IERC721Upgradeable public nft;
    // Token id of NFT
    uint256 private nftTokenId;
    // ERC20 bid token
    IERC20Upgradeable public acceptedToken;
    // the minimum amount of wei that the seller is willing to accept for the item
    uint256 private reservePrice;
    // Initial block number
    uint256 private _initialBlock;
    // the number of blockchain blocks that the auction is open for
    uint256 private numBlocksAuctionOpen;
    // the amount of wei that the auction price should decrease by during each subsequent block.
    uint256 private offerPriceDecrement;
    // The initial price of the item
    uint256 private _initialPrice;
    // Whether the auction is open or closed
    bool private _auctionOpen;
    /*
     Stakeholders
    */
    // the winning buyer of the item
    address private _buyer;
    // List of bidders
    address payable[] public _bidders;
    // Bidders and their bid amounts
    mapping(address => uint256) public _bids;

    constructor() {}

    function initialize(
        address erc20TokenAddress,
        address erc721TokenAddress,
        uint256 _nftTokenId,
        uint256 _reservePrice,
        uint256 _numBlocksAuctionOpen,
        uint256 _offerPriceDecrement
    ) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        // Set auction parameters
        // Set NFT item
        nftTokenId = _nftTokenId;
        nft = IERC721Upgradeable(erc721TokenAddress);
        // Set ERC-20 token
        acceptedToken = IERC20Upgradeable(erc20TokenAddress);
        reservePrice = _reservePrice;
        numBlocksAuctionOpen = _numBlocksAuctionOpen;
        offerPriceDecrement = _offerPriceDecrement;
        // Open the auction
        _auctionOpen = true;
        // Set the initial block to current block
        _initialBlock = block.number;
        // Set the initial price of the item
        _initialPrice =
            _reservePrice +
            (_numBlocksAuctionOpen * _offerPriceDecrement);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal virtual override {}

    // View reserve price
    function getReservePrice() public view returns (uint256) {
        return reservePrice;
    }

    // Get NFT token ID
    function getNFTTokenId() public view returns (uint256) {
        return nftTokenId;
    }

    // View number of blockchain blocks that the auction is open for
    function getNumBlocksAuctionOpen() public view returns (uint256) {
        return numBlocksAuctionOpen;
    }

    // View price decrement
    function getOfferPriceDecrement() public view returns (uint256) {
        return offerPriceDecrement;
    }

    // View initial price
    function getInitialPrice() public view returns (uint256) {
        return _initialPrice;
    }

    // Get buyer address
    function getBuyer() public view returns (address) {
        return _buyer;
    }

    // View current price
    function getCurrentPrice() public view returns (uint256) {
        return
            _initialPrice -
            (block.number - _initialBlock) *
            offerPriceDecrement;
    }

    // Check auction status
    function isAuctionOpen() public view returns (bool) {
        // If number of blockchain blocks has been exceeded, auction is closed
        if (
            block.number > _initialBlock + numBlocksAuctionOpen &&
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

    function bid(uint256 bidAmount) public nonReentrant {
        // Check that the auction is still open
        require(isAuctionOpen() == true, "Auction is closed!");
        // Check that the bid is greater than the reserve price
        require(bidAmount >= reservePrice, "Bid is below reserve price!");
        // Transfer tokens from bidder to the contract
        acceptedToken.transferFrom(msg.sender, address(this), bidAmount);
        // Add current bidder to the list of bidders
        _bidders.push(payable(msg.sender));

        // If the bid is greater than or equal to the current price, declare the winner, refund other bidders, and close the auction
        if (bidAmount >= getCurrentPrice()) {
            // Declare the winner & close the auction
            _buyer = msg.sender;
            _auctionOpen = false;

            // Send money to the seller, assuming it is the contract owner
            acceptedToken.transfer(owner(), bidAmount);

            // Approve the buyer
            nft.approve(msg.sender, nftTokenId);

            // Transfer the NFT to the buyer
            nft.transferFrom(nft.ownerOf(nftTokenId), msg.sender, nftTokenId);

            // Record the winning bid
            _bids[msg.sender] = bidAmount;

            // Refund all other bidders
            for (uint i = 0; i < _bidders.length; i++) {
                address payable bidder = _bidders[i];

                if (bidder != msg.sender) {
                    uint256 bidToRefund = _bids[bidder];
                    require(
                        acceptedToken.balanceOf(address(this)) >= bidToRefund,
                        "Not enough tokens to refund bidder!"
                    );
                    acceptedToken.transfer(bidder, bidToRefund);
                    _bids[bidder] = 0;
                }
            }
        } else {
            // Otherwise, accept and record the bid amount
            _bids[msg.sender] += bidAmount;
        }
    }

    function getInitialVersion() external pure returns (string memory) {
        return "V1";
    }
}
