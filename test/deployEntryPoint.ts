import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { EntryPoint } from '../typechain-types';



const deployEntryPoint = async function (hre: HardhatRuntimeEnvironment) : Promise<EntryPoint> {
  const entrypoint = await hre.ethers.deployContract('EntryPoint')
  const ret = await entrypoint.waitForDeployment();
  const contract = await hre.ethers.getContractAt('EntryPoint', ret.target.toString());
  return contract;
}

export default deployEntryPoint

