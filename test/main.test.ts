import deployEntryPoint from "./deployEntryPoint";
import hre from "hardhat";
import { dateToHex, defaultAbiCoder, DefaultsForUserOp, hexConcat, packPaymasterData, UserOperation } from "../utils/UserOp";
import { computeSalt, createAccount, decodeRevertReason, fillSignAndPack, getUserOpHash, simulateValidation } from "../utils/testUtils";
import deployPayMaster from "./deployPaymentMaster";
import { expect } from "chai";
import { describe, it } from 'mocha';
import { Account, AccountFactory, EntryPoint } from "../typechain-types";
import { createAccountOwner, TWO_ETH } from "../utils/constants";
import deployAccountFactory from "./deployAccountFactory";

import { Signer, Wallet } from 'ethers'
import { hexZeroPad, zeroPad } from "@ethersproject/bytes";
const { ethers } = hre;


describe('#EntryPoint with Paymaster', function () {

  let entryPoint: EntryPoint;
  let account: Account;
  let accountOwner: Wallet;
  let offChainSigner: Wallet;
  let paymaster: string;
  let accountFactory: AccountFactory;
  let ethersSigner: Signer;
  let salt: string;
  const VALID_UNTIL = dateToHex(new Date(Date.now() + 1000 * 60 * 60 * 24 * 365)); // 1 year
  const VALID_AFTER = dateToHex(new Date(Date.now() - 1000 * 60 * 60 * 24 * 365)); // 1 year ago

  before(async function () {
    this.timeout(20000) // 20s
    entryPoint = await deployEntryPoint(hre);
    const entrypointAddr = await entryPoint.getAddress();
    accountFactory = await deployAccountFactory(hre, entrypointAddr);
    ethersSigner = await ethers.provider.getSigner()
    accountOwner = createAccountOwner();
    offChainSigner = createAccountOwner();
    paymaster = await deployPayMaster(hre, entrypointAddr, offChainSigner.address);
    const paymasterContract = await ethers.getContractAt('PaymentMaster', paymaster);
    await paymasterContract.addStake(1, { value: TWO_ETH });
    salt = computeSalt(accountOwner.address);
    const { proxy } = await createAccount(ethersSigner, accountOwner.address, entrypointAddr, accountFactory)
    account = proxy;
  }
  );


  describe('#parsePaymasterData', async () => {

    it('should parse paymaster data', async () => {
      const paymentMaster = await ethers.getContractAt('PaymentMaster', paymaster);
      const accountAddress = await accountFactory.getAddress(accountOwner.address, salt);
      const codeSize = await ethers.provider.getCode(accountAddress);
      const signer = await ethersSigner.getAddress();

      const res = await paymentMaster.parsePaymasterAndData(packPaymasterData(
        paymaster,
        DefaultsForUserOp.paymasterVerificationGasLimit,
        DefaultsForUserOp.paymasterPostOpGasLimit,
        hexConcat([
          defaultAbiCoder.encode(['uint48', 'uint48'], [VALID_UNTIL, VALID_AFTER]), signer
        ])
      ));
      expect(res.validUntil).to.equal(ethers.toBigInt(VALID_UNTIL));
      expect(res.validAfter).to.equal(ethers.toBigInt(VALID_AFTER));
      expect(res.signature).to.equal(signer.toLowerCase());
      expect(codeSize).to.not.equal("0x");
    }
    );
  });

  describe('#validatePaymasterUserOp', () => {
    it('should reject for Sender is not entry point   ', async () => {
      const userOp = await fillSignAndPack({
        sender: await account.getAddress(),
        paymaster: paymaster,
        paymasterData: hexConcat([
          defaultAbiCoder.encode(['uint48', 'uint48'], [VALID_UNTIL, VALID_AFTER]), await ethersSigner.getAddress()
        ])
        }, accountOwner, entryPoint, VALID_UNTIL, VALID_AFTER);
        const PaymentMasterContract = await ethers.getContractAt('PaymentMaster', paymaster);
      
        await expect(PaymentMasterContract.validatePaymasterUserOp(userOp.userOp, userOp.userOpHash, 0)).to.be.revertedWith('Sender not EntryPoint');
    })            
    });
 })

describe('#Hexcontact', function () {
  const VALID_UNTIL =  dateToHex(new Date(Date.now() + 1000 * 60 * 60 * 24 * 365)); // 1 year
  const VALID_AFTER =  dateToHex(new Date(Date.now() - 1000 * 60 * 60 * 24 * 365)); // 1 year ago
  it('should concat hex strings', async () => {
    const res = hexConcat(['0x1234', '0x5678']);
    expect(res).to.equal('0x12345678');
  });

  it('should be able to concat VALID_UNTIL and VALID_AFTER', async () => {
    const encoded = defaultAbiCoder.encode(['uint48', 'uint48'], [VALID_UNTIL, VALID_AFTER]);
    const concatenated = hexConcat([hexZeroPad(VALID_UNTIL, 32), hexZeroPad(VALID_AFTER, 32)]);
    expect(encoded).to.equal(concatenated);    
  }
);
   
});

