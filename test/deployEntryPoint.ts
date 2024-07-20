import { HardhatRuntimeEnvironment } from 'hardhat/types'



const deployEntryPoint = async function (hre: HardhatRuntimeEnvironment) {
  const entrypoint = await hre.ethers.deployContract('EntryPoint')
  const ret = await entrypoint.waitForDeployment();
  return ret.target
}

export default deployEntryPoint

