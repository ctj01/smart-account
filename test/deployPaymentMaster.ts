import { HardhatRuntimeEnvironment } from 'hardhat/types'


const deployPayMaster  = async function (hre: HardhatRuntimeEnvironment, entrypointAddr: string) {;
    const payMaster = await hre.ethers.getContractFactory('PaymentMaster');
    const tx = await payMaster.deploy(entrypointAddr,  entrypointAddr, { gasLimit: 6e6 });
    const ret = await tx.waitForDeployment();
    return ret.target;
}

export default deployPayMaster