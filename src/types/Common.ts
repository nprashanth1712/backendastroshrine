import { AWSError } from "aws-sdk";
import { PromiseResult } from "aws-sdk/lib/request";

export type DynOutWithError<T> = PromiseResult<T, AWSError>;

export type Optional<T> = T | null;