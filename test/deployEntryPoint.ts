import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'


const deployEntryPoint: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const provider = ethers.provider
  const entrypoint = await hre.ethers.getContractFactory('EntryPoint')
  const from = (await provider.getSigner()).address
  const tx = await entrypoint.deploy({ from, gasLimit: 6e6 
    // deterministicDeployment: process.env.SALT ?? true,
  })
  const ret = await tx.deployed()
  console.log('==entrypoint addr=', ret.address)
}

export default deployEntryPoint

