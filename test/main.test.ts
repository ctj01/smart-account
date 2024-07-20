import deployEntryPoint from "./deployEntryPoint";
import hre from "hardhat";
import { dateToHex, defaultAbiCoder, DefaultsForUserOp, hexConcat, packPaymasterData } from "../utils/UserOp";
import deployPayMaster from "./deployPaymentMaster";
import { expect } from "chai";
import { describe, it } from 'mocha';

const { ethers } = hre;

describe('#parsePaymasterAndData', () => {
  it('should parse data properly', async () => {
    const entrypoint = await deployEntryPoint(hre);
    const signer = (await ethers.getSigners())[0];
    const paymasterContract = await deployPayMaster(hre, entrypoint.toString());
    
    const VALID_UNTIL = dateToHex(new Date(Date.now() + 1000 * 60 * 60 * 24 * 365)); // 1 year
    const VALID_AFTER = dateToHex(new Date(Date.now() - 1000 * 60 * 60 * 24 * 365)); // 1 year ago
    
    const paymaster = await ethers.getContractAt('PaymentMaster', paymasterContract);
    
    const res = await paymaster.parsePaymasterAndData(packPaymasterData(
      paymasterContract.toString(),
      DefaultsForUserOp.paymasterVerificationGasLimit,
      DefaultsForUserOp.paymasterPostOpGasLimit,
      hexConcat([
        defaultAbiCoder.encode(['uint48', 'uint48'], [VALID_UNTIL, VALID_AFTER]), signer.address
      ])
    ));
    
    expect(res.validUntil).to.equal(ethers.toBigInt(VALID_UNTIL));
    expect(res.validAfter).to.equal(ethers.toBigInt(VALID_AFTER));
  });
});
