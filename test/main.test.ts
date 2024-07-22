import deployEntryPoint from "./deployEntryPoint";
import hre from "hardhat";
import { dateToHex, defaultAbiCoder, DefaultsForUserOp, hexConcat, packPaymasterData } from "../utils/UserOp";
import { createAccount, decodeRevertReason, fillSignAndPack, simulateValidation } from "../utils/testUtils";
import deployPayMaster from "./deployPaymentMaster";
import { expect } from "chai";
import { describe, it } from 'mocha';
import { Account, AccountFactory, EntryPoint } from "../typechain-types";
import { createAccountOwner, TWO_ETH } from "../utils/constants";
import deployAccountFactory from "./deployAccountFactory";

import { Signer, Wallet } from 'ethers'
const { ethers } = hre;


describe('#EntryPoint with Paymaster', function () {

  let entryPoint: EntryPoint;
  let account: Account;
  let accountOwner: Wallet;
  let offChainSigner: Wallet;
  let paymaster: string;
  let accountFactory: AccountFactory;
  let ethersSigner: Signer;
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

    const { proxy } = await createAccount(ethersSigner, accountOwner.address, entrypointAddr, accountFactory)
    account = proxy;
  }
  );


  describe('#parsePaymasterData', async () => {

    it('should parse paymaster data', async () => {



      const paymentMaster = await ethers.getContractAt('PaymentMaster', paymaster);

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
    }
    );
  });


  describe('#validatePaymasterUserOp', () => {
    it('should reject on no signature', async () => {

      const entryPointAddress = await entryPoint.getAddress();

      const op =  {
        sender: await account.getAddress(),
        paymaster: paymaster,
        paymasterData: hexConcat([defaultAbiCoder.encode(['uint48', 'uint48'], [VALID_UNTIL, VALID_AFTER]), '0x1234'])
      }

      const userOp = await fillSignAndPack(op, accountOwner, entryPoint);


      expect(await simulateValidation(userOp, entryPointAddress)
        .catch(e => decodeRevertReason(e)))
        .to.include('invalid signature length in paymasterAndData')
    });
  });



});
