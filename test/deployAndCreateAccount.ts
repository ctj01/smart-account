import { HardhatRuntimeEnvironment } from "hardhat/types";
import deployAccountFactory from "./deployAccountFactory";

export const createAccount = async function (hre: HardhatRuntimeEnvironment, entrypointAddr: string) {
    const accountFactory = await deployAccountFactory(hre, entrypointAddr);
    const provider = hre.ethers.provider;
    const from = (await provider.getSigner()).address;
    const accountFactoryContract = await hre.ethers.getContractAt('AccountFactory', accountFactory);
}