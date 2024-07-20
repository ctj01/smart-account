import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'

const deployAccountFactory  = async function (hre: HardhatRuntimeEnvironment, entrypointAddr: string) {
    const provider = ethers.provider
    const accountFactory = await hre.ethers.getContractFactory('AccountFactory')
    const from = (await provider.getSigner()).address
    const tx = await accountFactory.deploy( entrypointAddr, { from, gasLimit: 6e6
        // deterministicDeployment: process.env.SALT ??
    })
    const ret = await tx.waitForDeployment();
    return ret.target;
}

export default deployAccountFactory