import { ethers } from "hardhat"
const { Wallet } = ethers;
export const parseEther = ethers.parseEther;

export const AddressZero = "0x0000000000000000000000000000000000000000";
export const HashZero = "0x0000000000000000000000000000000000000000000000000000000000000000";
export const ONE_ETH = parseEther('1')
export const TWO_ETH = parseEther('2')
export const FIVE_ETH = parseEther('5')
export const createAccountOwner = () => Wallet.createRandom().connect(ethers.provider);
