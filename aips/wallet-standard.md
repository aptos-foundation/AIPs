---
aip: (this is determined by the AIP Manager, leave it empty when drafting)
title: Wallet Standard
author: 0xmaayan, hardsetting, NorbertBodziony
discussions-to (*optional): <a url pointing to the official discussion thread>
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

1. While wallets often injected into their own designated namespace (e.g. window.aptos), there is nothing stopping another wallet from injecting into the same namespace. As a result, wallets can mimic themselves as a suspicious wallet and users who have multiple injected wallets can often experience unwanted interferences.
2. Since wallets attach themselves to the window as global objects, dApps need to be made aware of how they can find these objects and must choose to support a limited number of wallets that may not be relevant to the user.
3. The standard is deeply integrated within the Aptos wallet adapter and any change can cause breaking changes for dapps and wallets and creates endless maintenance work by requiring a dapp or wallet to implement these changes.
4. Since each dapp needs to install and maintain a wallet plugin dependency, it is exposed to a potential supply chain attack.
5. The standard supports only the legacy TS SDK input, types and logic. That means that it doesnt enjoy the features and enhancements of the new TS SDK has to offer. In addition, the legacy TS SDK does not get anymore support or new features.Moreover, the standard uses the `any` type which is less than optimal, we should use strong typing mechanism.

In this proposal, we suggest bringing a new way of communication between a wallet and a dapp to Aptos that eliminates all the above issues.

## Impact

1. Dapp developers

- Familiarize themselves with the new standard
- Migrate to the new TypeScript SDK
- Support a wallet discoverable function and filter out non-aptos wallets
- Once a Wallet has migrated to the new standard, can remove the wallet package dependency from the dapp

2. Wallet developers

- Familiarize themselves with the new standard
- Migrate to the new TypeScript SDK
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

`aptos:changeNetwork`\* event for the dapp to send to the wallet to change the wallet’s current network

```
// `network:NetworkInfo` - - The network for the wallet to change to

changeNetwork(network:NetworkInfo):Promise<UserResponse<{success: boolean,reason?: string}>>
```

`aptos:openInMobileApp`\* a function that supports redirecting a user from a web browser on mobile to a native mobile app. The wallet plugin should add the location url a wallet should open the in-app browser at.

```
openInMobileApp(): void
```

Types

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
  name: string // Name of the network.
  chainId: string // Chain ID of the network.
  url?: string // RPC URL of the network.
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
  signature: string | string[]
  bitmap?: Uint8Array
}
```

## Reference Implementation

The standard exposes a [detect](https://github.com/aptos-labs/wallet-standard/blob/main/src/detect.ts#L17) functionality to detect if existing wallets conform with the Aptos standard by validating required functions are available in the wallet. These functions are called [features](https://github.com/aptos-labs/wallet-standard/tree/main/src/features). Each feature should be defined with an `aptos` namespace, `semicolon` and the `{method}` name, i.e `aptos:connect`.

**Wallet Provider**

A wallet registers itself using the [registerWallet](https://github.com/wallet-standard/wallet-standard/blob/master/packages/core/wallet/src/register.ts#L25) method to notify the dapp it is ready to be registered.

A wallet must implement a [Wallet interface](https://github.com/aptos-labs/wallet-standard/blob/main/src/wallet.ts#L6) with the wallet provider info and features:

````ts
interface Wallet {
  /**
   * Name of the Wallet. This may be displayed by the app.
   */
  readonly name: string;

  /**
   * Icon of the Wallet. This may be displayed by the app.
   */
  readonly icon: `data:image/${
    | "svg+xml"
    | "webp"
    | "png"
    | "gif"};base64,${string}`;

  /**
   * Chains supported by the Wallet.
   */
  readonly chains: Array<`${string}:${string}`>; // e.g. 'aptos:devnet'

  /**
   * Website URL of the Wallet. This may be used by the app.
   */
  readonly url: string;

  /**
   * Features supported by the Wallet.
   *
   * A feature may have any type. It may be a single method or value, or a collection of them.
   *
   * A conventional feature has the following structure:
   *
   * ```ts
   *  export type AptosConnectFeature = {
   *      // Name of the feature.
   *      'aptos:connect': {
   *          // Version of the feature.
   *          version: '1.0.0';
   *          // Methods of the feature.
   *          connect (silent?: boolean, networkInfo?: NetworkInfo): Promise<UserResponse<AccountInfo>>;
   *      };
   *  };
   * ```
   */
  readonly features: Readonly<Record<`${string}:${string}`, T>>;
}

class AptosWallet implements Wallet {
  name = "Aptos Wallet" as const;

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
````

**Dapp**

A dapp uses the [getWallets()](https://github.com/wallet-standard/wallet-standard/blob/master/packages/core/app/src/wallets.ts#L41) function which gets all the wallets in the window object. Then it can [filter](https://github.com/aptos-labs/wallet-standard/blob/main/src/detect.ts#L17) the list to get only the Aptos compatible wallets.

A dapp makes a wallet request by calling the feature name that coresponds to the desired actions.

```ts
const onConnect = () => {
  this.wallet.features["aptos:connect"]();
};
```

## Risks and Drawbacks

The new standard uses the new TypeScript SDK types and therefore requires dapps and wallets to use/migrate to the new TypeScript SDK or hold a conversion layer from the new TypeScript SDK types to the legacy TypeScript SDK types.

## Future Potential

1. This solution is a general implementation that has already being used by different chains and would hopefully get adopted by more chains. With that, the migration effort of a wallet from one chain to another is minimal. In addition, multi-chain dapps can easliy detect any wallet that conforms with the standard.
2. Both dapps and wallets integration and implementation is straightforawrd and painless. Mostly each needs to use a provided method for registration/detection.
3. The addition of any future features and/or enhancements should not introduce any breaking change as each wallet holds its own plugin code and any feature/method lives in its own context.

## Timeline

### Suggested implementation timeline

Once the AIP is approved, dapps and wallets can implement the required changes to conform with the new standard.
