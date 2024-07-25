
import { Signer, solidityPackedKeccak256, Wallet, Interface, keccak256, Contract, toBeArray, solidityPackedSha256 } from 'ethers'
import { Account, EntryPoint, AccountFactory, Account__factory, AccountFactory__factory, EntryPointSimulations__factory, IEntryPointSimulations, EntryPoint__factory } from "../typechain-types";
import { dateToHex, defaultAbiCoder, DefaultsForUserOp, encodeUserOp, packAccountGasLimits, PackedUserOperation, packPaymasterData, packUserOp, UserOperation } from './UserOp';
import EntryPointSimulationsJson from '@account-abstraction/contracts/artifacts/EntryPointSimulations.json'
import { ResultFillAndSign, ResultFillPackSign } from '../interfaces/result/Result';

import { ethers } from 'hardhat';
import { arrayify, hexDataSlice, hexlify } from '@ethersproject/bytes';
import { json } from 'hardhat/internal/core/params/argumentTypes';
import { PackedUserOperationStruct } from '../typechain-types/contracts/Account';

export async function createAccount(
    ethersSigner: Signer,
    accountOwner: string,
    entryPoint: string,
    _factory?: AccountFactory
):
    Promise<{
        proxy: Account
        accountFactory: AccountFactory
        implementation: string
    }> {
    if (!_factory) {
        _factory = AccountFactory__factory.connect(entryPoint, ethersSigner)
    }
    const salt = computeSalt(accountOwner);

    const implementation = await _factory?.accountImplementation()
    await _factory?.createAccount(accountOwner, salt)
    const address = await _factory?.getAddress(accountOwner, salt)

    const proxy = await Account__factory.connect(address, ethersSigner)

    return { proxy, accountFactory: _factory, implementation: implementation }
}


export const computeSalt = (accountOwner: string) => solidityPackedKeccak256(['address'], [accountOwner])

export function getUserOpHash(op: UserOperation, entryPoint: string, chainId: bigint): string {


    const userOpHash = encodeUserOp(op, true)
    let enc = solidityPackedKeccak256(
        ['bytes', 'address', 'uint256'],
        [keccak256(userOpHash), entryPoint, chainId]
    )


    return keccak256(enc)
}





export async function fillUserOp(op: Partial<UserOperation>, entryPoint?: EntryPoint, getNonceFunction = 'getNonce'): Promise<UserOperation> {
    const op1 = { ...op }
    const provider = ethers.provider
    const eAddress = await entryPoint?.getAddress()
    if (op.initCode != null) {
        const initAddr = hexDataSlice(op1.initCode!, 0, 20)
        const initCallData = hexDataSlice(op1.initCode!, 20)
        if (op1.nonce == null) op1.nonce = 0

        if (op1.verificationGasLimit == null) {
            if (provider == null) throw new Error('no entrypoint/provider')
            const initEstimate = await provider.estimateGas({
                from: eAddress,
                to: initAddr,
                data: initCallData,
                gasLimit: 10e6
            })
            op1.verificationGasLimit = BigInt(DefaultsForUserOp.verificationGasLimit) + BigInt(initEstimate)
        }
    }
    if (op1.nonce == null) {
        if (provider == null) throw new Error('must have entryPoint to autofill nonce')
        const c = new Contract(op.sender!, [`function ${getNonceFunction}() view returns(uint256)`], provider)
        op1.nonce = await c[getNonceFunction]().catch(() => 0)
    }

    if (op1.paymaster != null) {
        if (op1.paymasterVerificationGasLimit == null) {
            op1.paymasterVerificationGasLimit = DefaultsForUserOp.paymasterVerificationGasLimit
        }
        if (op1.paymasterPostOpGasLimit == null) {
            op1.paymasterPostOpGasLimit = DefaultsForUserOp.paymasterPostOpGasLimit
        }
    }
    if (op1.maxFeePerGas == null) {
        if (provider == null) throw new Error('must have entryPoint to autofill maxFeePerGas')
        const block = await provider.getBlock('latest')
        op1.maxFeePerGas = block?.baseFeePerGas ?? DefaultsForUserOp.maxPriorityFeePerGas ?? DefaultsForUserOp.maxPriorityFeePerGas;
    }
    // TODO: this is exactly what fillUserOp below should do - but it doesn't.
    // adding this manually
    if (op1.maxPriorityFeePerGas == null) {
        op1.maxPriorityFeePerGas = DefaultsForUserOp.maxPriorityFeePerGas
    }
    const op2 = fillUserOpDefaults(op1);
    // eslint-disable-next-line @typescript-eslint/no-base-to-string

    return op2
}

export function fillUserOpDefaults(op: Partial<UserOperation>, defaults = DefaultsForUserOp): UserOperation {
    const partial: any = { ...op }
    // we want "item:undefined" to be used from defaults, and not override defaults, so we must explicitly
    // remove those so "merge" will succeed.
    for (const key in partial) {
        if (partial[key] == null) {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete partial[key]
        }
    }
    const filled = { ...defaults, ...partial }
    return filled
}


export async function fillAndSign(op: Partial<UserOperation>, signer: Signer | Wallet, entryPoint?: EntryPoint, validUntil?: string, validAfter?: string, getNonceFunction = 'getNonce'): Promise<ResultFillAndSign> {
    {
        if (validUntil == null) {
            validUntil = dateToHex(new Date(Date.now() + 1000 * 60 * 60 * 24 * 365))
        }
        if (validAfter == null) {
            validAfter = dateToHex(new Date(Date.now() - 1000 * 60 * 60 * 24 * 365))
        }
        const provider = signer.provider;
        const entryPointAddress = await entryPoint?.getAddress() as string;
        const userOp = await fillUserOp(op, entryPoint, getNonceFunction) as UserOperation;
        const chainId = await provider?.getNetwork();
        const PaymentMasterContract = await ethers.getContractAt('PaymentMaster', op.paymaster as string);
        const packedUserOp = packUserOp(userOp);
        let signature;
        let userOpHash;
        try {
            userOpHash = await PaymentMasterContract.getHash(packedUserOp, validUntil, validAfter);
            const message = defaultAbiCoder.encode(['bytes32', 'address', 'uint256'], [userOpHash, entryPointAddress, chainId?.chainId]);
            const messageHash = keccak256(message);
            signature = await signer.signMessage(arrayify(messageHash));
        } catch (error) {
            throw new Error('Failed to sign message: ' + error);
        }



        const userOpWithSignature = { ...userOp, signature }
        return {
            userOp: userOpWithSignature,
            signature,
            userOpHash
        }

    }
}


export async function fillSignAndPack(op: Partial<UserOperation>, signer: Signer | Wallet, entryPoint?: EntryPoint, validUntil?: string, validAfter?: string, getNonceFunction = 'getNonce'): Promise<ResultFillPackSign> {
    const filledAndSignedOp = await fillAndSign(op, signer, entryPoint, validUntil, validAfter, getNonceFunction)
    const userOperation = packUserOp(filledAndSignedOp.userOp)

    return {
        userOp: userOperation,
        signature: filledAndSignedOp.signature,
        userOpHash: filledAndSignedOp.userOpHash
    }
}

export async function simulateValidation(
    userOp: PackedUserOperationStruct,
    entryPointAddress: string,
    txOverrides?: any): Promise<IEntryPointSimulations.ValidationResultStructOutput> {
    const entryPointSimulations = EntryPointSimulations__factory.createInterface()
    const data = entryPointSimulations.encodeFunctionResult('simulateValidation', [userOp]);
    const tx = {
        to: entryPointAddress,
        data,
        ...txOverrides
    }
    const stateOverride = {
        [entryPointAddress]: {
            code: EntryPointSimulationsJson.deployedBytecode
        }
    }
    console.log(txOverrides)
    try {
        const simulationResult = await ethers.provider.send('eth_call', [tx, 'latest', stateOverride])
        const res = entryPointSimulations.decodeFunctionResult('simulateValidation', simulationResult)
        // note: here collapsing the returned "tuple of one" into a single value - will break for returning actual tuples
        return res[0]
    } catch (error: any) {
        const revertData = error?.data
        if (revertData != null) {
            // note: this line throws the revert reason instead of returning it
            entryPointSimulations.decodeFunctionResult('simulateValidation', revertData)
        }
        throw error
    }
}

export function decodeRevertReason(data: string | Error, nullIfNoMatch = true): string | null {
    if (typeof data !== 'string') {
        const err = data as any
        data = (err.data ?? err.error?.data) as string
        if (typeof data !== 'string') throw err
    }

    const methodSig = data.slice(0, 10)
    const dataParams = '0x' + data.slice(10)

    // can't add Error(string) to xface...
    if (methodSig === '0x08c379a0') {
        const [err] = defaultAbiCoder.decode(['string'], dataParams)
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        return `Error(${err})`
    } else if (methodSig === '0x4e487b71') {
        const [code] = defaultAbiCoder.decode(['uint256'], dataParams)
        return `Panic(${panicOpCodes[code] ?? code} + ')`
    }

    try {
        const err = decodeRevertReasonContracts.parseError(data)
        // treat any error "bytes" argument as possible error to decode (e.g. FailedOpWithRevert, PostOpReverted)
        const args = err?.args.map((arg: any, index) => {

            switch (err?.fragment.inputs[index].type) {
                case 'bytes': return decodeRevertReason(arg)
                case 'string': return `"${(arg as string)}"`
                default: return arg
            }
        })
        return `${err?.name}(${args?.join(',')})`
    } catch (e) {
        // throw new Error('unsupported errorSig ' + data)
        if (!nullIfNoMatch) {
            return data
        }
        return null
    }
}

const panicOpCodes: { [key: number]: string } = {
    // from https://docs.soliditylang.org/en/v0.8.0/control-structures.html
    0x01: 'assert(false)',
    0x11: 'arithmetic overflow/underflow',
    0x12: 'divide by zero',
    0x21: 'invalid enum value',
    0x22: 'storage byte array that is incorrectly encoded',
    0x31: '.pop() on an empty array.',
    0x32: 'array sout-of-bounds or negative index',
    0x41: 'memory overflow',
    0x51: 'zero-initialized variable of internal function type'
}

const decodeRevertReasonContracts = new Interface([
    ...EntryPoint__factory.createInterface().fragments,
    'error ECDSAInvalidSignature()'
]) // .fi