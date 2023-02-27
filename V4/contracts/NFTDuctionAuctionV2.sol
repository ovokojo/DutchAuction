// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./NFTDuctionAuction_ERC20Bids.sol";

contract NFTDutchAuctionV2 is NFTDuctionAuction_ERC20Bids {
    function getUpdatedVersion() external pure returns (string memory) {
        return "V2";
    }
}
