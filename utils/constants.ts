import { arrayify } from "@ethersproject/bytes";
import { ethers } from "hardhat"
const { Wallet, keccak256 } = ethers;
let counter = 0;
export const parseEther = ethers.parseEther;

export const AddressZero = "0x0000000000000000000000000000000000000000";
export const HashZero = "0x0000000000000000000000000000000000000000000000000000000000000000";
export const ONE_ETH = parseEther('1')
export const TWO_ETH = parseEther('2')
export const FIVE_ETH = parseEther('5')
export function createAccountOwner ()   {
    counter++;
    const privateKey = keccak256(arrayify(Buffer.from(counter.toString())));
    return new Wallet(privateKey, ethers.provider);
}
export function createAddress (): string {
    return createAccountOwner().address
  }

