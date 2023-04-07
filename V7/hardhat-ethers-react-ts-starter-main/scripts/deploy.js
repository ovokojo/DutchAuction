async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);

    console.log("Account balance:", (await deployer.getBalance()).toString());

    const AuctionFactory = await ethers.getContractFactory("BasicDutchAuction");
    const auction = await AuctionFactory.deploy(deployer.address, 1000000000000000n, 1000n, 100000000n);

    console.log("Auction address:", auction.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });