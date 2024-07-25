import { PackedUserOperationStruct } from '../../typechain-types/contracts/Account'
import { UserOperation } from '../../utils/UserOp';
export interface ResultFillPackSign {
    userOp: PackedUserOperationStruct
    signature: string
    userOpHash: string
};

export interface ResultFillAndSign {
    userOp: UserOperation
    signature: string,
    userOpHash: string
}