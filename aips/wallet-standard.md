---
aip: (this is determined by the AIP Manager, leave it empty when drafting)
title: Wallet Standard
author: 0xmaayan, hardsetting, NorbertBodziony
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/306
Status: Draft
last-call-end-date (*optional): 09/02/2024
type: Standard
created: 29/01/2024
---

# AIP-X - Wallet Standard

## Summary

A Wallet Standard is an interface a wallet implements. This AIP introduces a new wallet standard for the Aptos ecosystem.

## Motivation

Most web wallets today come in the form of browser extensions. These extensions interact with dApps by injecting code into every website the user visits. There are several issues with the way injection works today.

1. Wallets inject themselves to the global window object and exepct a dapp to detect them by reading the window object. This method requires the dapp to be made aware of how they can find these objects and must choose to support a limited number of wallets that may not be relevant to the user. In addition, this method creates a race condition risk in the case the dapp loads before a wallet.
2. The standard is deeply integrated within the Aptos wallet adapter, and any change can cause breaking changes for dApps and wallets, creating endless maintenance work by requiring a dApp or wallet to implement these changes.
3. Since each dApp needs to install and maintain a wallet plugin dependency, it is exposed to a potential supply chain attack.
4. The standard supports only the legacy TS SDK input, types, and logic. That means that it doesn't enjoy the features and enhancements of the new TS SDK. In addition, the legacy TS SDK does not receive any more support or new features. Moreover, the standard uses the `any` type, which is less than optimal; we should use a strong typing mechanism.

In this proposal, we suggest bringing a new way of communication, events listener/dispatcher based, between a wallet and a dapp to Aptos that eliminates all the above issues.

## Impact

1. Dapp developers

- Familiarize themselves with [the new standard](https://github.com/aptos-labs/wallet-standard/tree/main)
- Migrate to the [new TypeScript SDK](https://github.com/aptos-labs/aptos-ts-sdk)
- Support a wallet discoverable function and filter out non-aptos wallets
- Once a Wallet has migrated to the new standard, can remove the wallet package dependency from the dapp

2. Wallet developers

- Familiarize themselves with [the new standard](https://github.com/aptos-labs/wallet-standard/tree/main)
- Migrate to the [new TypeScript SDK](https://github.com/aptos-labs/aptos-ts-sdk)
  - Or hold a conversion layer from the new TypeScript SDK types to the legacy TypeScipt SDK types
- Register the wallet so it will be discoverable by the dapp
- Implementation of a Wallet class that conforms with the new standard

## Rationale

This [chain agnostic solution](https://github.com/wallet-standard/wallet-standard) has been introduced as a generalized standard for wallets and dapps communication and has already been implemented on [Solana](https://github.com/wallet-standard/wallet-standard) and [Sui](https://docs.sui.io/standards/wallet-standard), and the [Ethereum](https://eips.ethereum.org/EIPS/eip-6963) community recently proposed a similar solution.

## Specification

The [Wallet Standard](https://github.com/aptos-labs/wallet-standard) is a chain-agnostic set of interfaces and conventions that aim to improve how applications interact with injected wallets.

**Standard Features**

A standard feature is a method that must or should be supported and implemented by a wallet.
Here is a list of the suggested [features](https://github.com/aptos-labs/wallet-standard/tree/main/src/features)

> a feature marked with `*` is an optional feature

`aptos:connect` method to establish a connection between a dapp and a wallet.

```
// `silent?: boolean` - gives ability to trigger connection without user prompt (for example, for auto-connect)
// `networkInfo?: NetworkInfo` - defines the network that the dapp will use (shortcut for connect and change network)

connect(silent?: boolean, networkInfo?: NetworkInfo): Promise<UserResponse<AccountInfo>>;
```

`aptos:disconnect` method to disconnect a connection established between a dapp and a wallet

```
disconnect(): Promise<void>;
```

`aptos:getAccount` to get the current connected account in the wallet

```
getAccount():Promise<UserResponse<AccountInfo>>
```

`aptos:getNetwork` to get the current network in the wallet

```
getNetwork(): Promise<UserResponse<NetworkInfo>>;
```

`aptos:signAndSubmitTransaction` method to sign and submit a transaction using the current connected account in the wallet.

```
// `transaction: AnyRawTransaction` - a generated raw transaction created with Aptos’ TS SDK

signAndSubmitTransaction(transaction: AnyRawTransaction): Promise<UserResponse<PendingTransactionResponse>>;
```

`aptos:signTransaction` for the current connected account in the wallet to sign a transaction using the wallet.

```
// `transaction: AnyRawTransaction` - a generated raw transaction created with Aptos’ TS SDK

signTransaction(transaction: AnyRawTransaction):AccountAuthenticator
```

`aptos:signMessage` for the current connected account in the wallet to sign a message using the wallet.

```
// `message: AptosSignMessageInput` - a message to sign

signMessage(message: AptosSignMessageInput):Promise<UserResponse<AptosSignMessageOutput>>;
```

`aptos:onAccountChange` event for the wallet to fire when an account has been changed in the wallet.

```
// `newAccount: AccountInfo` - The new connected account

onAccountChange(newAccount: AccountInfo): Promise<void>
```

`aptos:onNetworkChange` event for the wallet to fire when the network has been changed in the wallet.

```
// `newNetwork: NetworkInfo` - The new wallet current network

onNetworkChange(newNetwork: NetworkInfo):Promise<void>
```

`aptos:changeNetwork*` event for the dapp to send to the wallet to change the wallet’s current network

```
// `network:NetworkInfo` - - The network for the wallet to change to

changeNetwork(network:NetworkInfo):Promise<UserResponse<{success: boolean,reason?: string}>>
```

`aptos:openInMobileApp*` a function that supports redirecting a user from a web browser on mobile to a native mobile app. The wallet plugin should add the location url a wallet should open the in-app browser at.

```
openInMobileApp(): void
```

Types

> Note: `UserResponse` type is used for when a user rejects a rejectable request. For example, when user wants to connect but instead closes the window popup.

```
export interface UserApproval<TResponseArgs> {
 status: 'approved'
 args: TResponseArgs
}

export interface UserRejection {
 status: 'rejected'
}

export type UserResponse<TResponseArgs> = UserApproval<TResponseArgs> | UserRejection;

export interface AccountInfo = { account: Account, ansName?: string }

export interface NetworkInfo {
  name: Network
  chainId: string
  url?: string
}

export type AptosSignMessageInput = {
  address?: boolean
  application?: boolean
  chainId?: boolean
  message: string
  nonce: string
}

export type AptosSignMessageOutput = {
  address?: string
  application?: string
  chainId?: number
  fullMessage: string
  message: string
  nonce: string
  prefix: 'APTOS'
  signature: Signature
  bitmap?: Uint8Array
}
```

## Reference Implementation

The standard exposes a [detect](https://github.com/aptos-labs/wallet-standard/blob/main/src/detect.ts#L17) functionality to detect if existing wallets conform with the Aptos standard by validating required functions are available in the wallet. These functions are called [features](https://github.com/aptos-labs/wallet-standard/tree/main/src/features). Each feature should be defined with an `aptos` namespace, `semicolon` and the `{method}` name, i.e `aptos:connect`.

**Wallet Provider**

A wallet must implement a [AptosWallet interface](https://github.com/aptos-labs/wallet-standard/blob/main/src/wallet.ts) with the wallet provider info and features:

```ts
class MyWallet implements AptosWallet {
  name = "My Wallet";

  icon = "data:image/png;base64,iVBORw0KG...SuQmCC";

  url = "https://aptos.dev";

  chains = APTOS_CHAINS;

  features: {
    'aptos:connect': {
      version:'1.0.0',
      connect: this.connect()
    }
  }

  connect:AptosConnectMethod = async ({silent,networkInfo}):Promise<UserResponse<AccountInfo>> => {
    // ...function implementation...
    return {status: 'approved', args: AccountInfo}
  }
}
```

A wallet registers itself using the [registerWallet](https://github.com/wallet-standard/wallet-standard/blob/master/packages/core/wallet/src/register.ts#L25) method to notify the dapp it is ready to be registered.

```ts
const myWallet = new MyWallet();

registerWallet(myWallet);
```

**Dapp**

A dapp uses the [getAptosWallets()](https://github.com/aptos-labs/wallet-standard/blob/main/src/detect.ts#L30) function which gets all the Aptos standard compatible wallets.

```ts
import { getAptosWallets } from "@aptos-labs/wallet-standard";

const wallets = getAptosWallets();
```

A dapp makes a wallet request by calling the feature name that coresponds to the desired actions.

```ts
const onConnect = () => {
  this.wallet.features["aptos:connect"].connect();
};
```

## Risks and Drawbacks

The new standard uses the [new TypeScript SDK](https://github.com/aptos-labs/aptos-ts-sdk) types and therefore requires dapps and wallets to use/migrate to the new TypeScript SDK or hold a conversion layer from the new TypeScript SDK types to the legacy TypeScript SDK types.

## Future Potential

This solution is a general implementation that has already been used by different chains and wallets and will probably be adopted by more projects. With that, the migration effort of a wallet from one chain to another is minimal. In addition, multi-chain dApps can easily detect any wallet that conforms to the standard.

Both dApps' and wallets' integration and implementation are straightforward and painless. Mostly, each needs to use a provided method for registration/detection.

The addition of any future features and/or enhancements should not introduce any breaking change, as each wallet holds its own plugin code, and any feature/method lives in its own context

## Timeline

### Suggested implementation timeline

Once the AIP is approved, dapps and wallets can implement the required changes (described in the "Reference Implementation" section) to conform with the new standard.

## Security Considerations

With the new discovery method we aim to remove the dapp responsibility on installing and maintaining different wallet packages and therefore eliminate a supply chain attack risk.

The new method has been implemented on [Solana](https://github.com/wallet-standard/wallet-standard) and [Sui](https://docs.sui.io/standards/wallet-standard), and the [Ethereum](https://eips.ethereum.org/EIPS/eip-6963) community recently proposed a similar solution.
Additionally, differene wallets have already integrated and implemented the new standard such as Phantom, Nightly, Brave Wallet, Martian, etc.
