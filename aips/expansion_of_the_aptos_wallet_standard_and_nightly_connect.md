---
aip:
title: Expansion of the Aptos Wallet Standard and the expansion of Nightly Connect on Aptos.
author: NB, Kimi82
discussions-to: https://github.com/aptos-foundation/AIPs/issues/27
Status: Draft
type: Interface
created: 01/12/2024
---

# AIP-54 - Expansion of the Aptos Wallet Standard and the expansion of Nightly Connect on Aptos.

## Summary

The process of adding new wallets to the dApp and then maintaining it currently creates too many conflicts and requires the involvement of too many people. Because of that, this process is complex and inefficient, hindering the development of wallets and consuming dApp builder time and resources. We will provide solutions that eliminate the need to manage wallets through dApps, making growth of the wallets easier and saving dApps time and resources.

Also, the current entry barrier for new dApps, especially mobile ones, is too high. Due to the lack of available tools, dApps have to build everything from scratch, even the most universal, basic functions necessary for every dApp. This wastes an enormous amount of time and resources by necessitating the creation of tools that look the same for every application, instead of focusing on the key elements of each application. We will provide and maintain tools that will significantly facilitate the building of mobile applications.

### Goals

Our goals are:

- To create tools that eliminate the need to manage wallets through dApps, simplifying and significantly speeding up wallet development, and saving time for dApp builders.
- To prepare a toolkit accessible to all Aptos builders, providing core functionality that will make building mobile applications on Aptos much simpler.

Our overarching goal is to create public goods products that will be used by every wallet, dApp, and mobile app.
...

## Motivation

We have been building a Nightly Wallet on Aptos for over a year, remembering the times before the mainnet.

The above-mentioned issues have been and continue to be the most burdensome for us, significantly slowing down the development and growth of our wallet. The implementation of the changes described here will solve not only our problems but also those of anyone building any dApp on Aptos.

Our solution will not only greatly facilitate the development of applications, saving time and resources, but will also provide a set of tools available to everyone, significantly lowering the entry barrier for future applications building on Aptos.

These tools will greatly ease the development of mobile applications, which are a huge part of the gaming, social media, and entertainment markets—areas that are perfect use cases for Aptos.

...

## Impact

- Wallet Builder
- dApp builder
- Mobile dApps builder

To deliver the benefits described above, wallet builders will need to adapt their wallets to the new, enhanced version of the Aptos Wallet Standard.

Subsequently, dApps will need to implement Nightly Connect, which serves as a fully automatic and permissionless Wallet Adapter, taking advantage of the expanded Aptos Wallet Standard.

...

## Alternative solutions

This solution has already proven that it works on [Solana](https://github.com/wallet-standard/wallet-standard) and [Sui](https://docs.sui.io/standards/wallet-standard), and even the [Ethereum](https://eips.ethereum.org/EIPS/eip-6963) community recently proposed a similar solution to address this problem. It has been proven effective on these chains and is currently considered the best solution, fully addressing the issues related to wallets for both dApp and wallet builders.

...

## Specification

We will achieve the above-mentioned goals by expanding the existing Aptos Wallet Standard, its implementation by wallets, and introducing Nightly Connect on Aptos.

...

### Aptos Wallet Standard

The standard defines methods for a wallet to implement and introduces an injection method for the wallet to implement so it can be discovered on the browser.

**The standard interface**

connect() method to establish a connection between a dapp and a wallet

```
 connect(silent?: boolean, networkInfo?: NetworkInfo): Promise\<Response\<AccountInfo\>\>;

```

disconnect() method to disconnect a connection established between a dapp and a wallet

```

disconnect(): Promise\<void\>;

```

getAccount() to get the current connected account in the wallet

```

getAccount():Promise\<Response\<AccountInfo\>\>

```

getNetwork() to get the current network in the wallet

```

getNetwork(): Promise\<Response\<NetworkInfo\>\>;

```

signAndSubmitTransaction() method to sign and submit a transaction using the current connected account in the wallet

```

signAndSubmitTransaction(transaction: AnyRawTransaction): Promise\<Response\<PendingTransactionResponse\>\>;

```

signTransaction() for the current connected account in the wallet to sign a transaction using the wallet

```

signTransaction(AnyRawTransaction):AccountAuthenticator

```

signMessage() for the current connected account in the wallet to sign a message using the wallet

```

signMessage(message: AptosSignMessageInput):Promise\<Response\<AptosSignMessageOutput\>\>;

```

onAccountChange() event for the wallet to fire when an account has been changed in the wallet

```

onAccountChange(newAccount: AccountInfo): Promise\<void\>

```

onNetworkChange() event for the wallet to fire when the network has been changed in the wallet

```

onNetworkChange(newNetwork: NetworkInfo):Promise\<void\>

```

changeNetwork() event for the dapp to send to the wallet to change the wallet's current network

```

changeNetwork(network:NetworkInfo):Promise\<Response\<{success: boolean,reason?: string}\>\>

```

```

// Rejected response

type export interface Rejected { status: 'rejected' reason?: string }

// Approved response

type export interface Approved\<TArgs\> { status: 'approved' args: TArgs }

// Unified Response

type export type Response\<TArgs\> = Approved\<TArgs\> | Rejected

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

**Required methods**

The standard defines required methods for the wallet to support in order to be recognized as a wallet who supports the standard.

```

connect()

signAndSubmitTransaction()

signMessage()

signTransaction()

```

### Nightly Connect

Nightly Connect is a fully permissionless and automated wallet adapter that takes advantage of the benefits provided by the extended Wallet Standard.

While the default option aggregates every standard-compliant wallet, we also empower dApps to filter through the wallet list and only service the chosen ones.

Nightly Connect also allows establishing a connection by scanning a QR Code and through deep links between any dApp and every wallet.

Apart from that, Nightly Connect can serve as a starting point for dApps building applications on Aptos. By providing basic infrastructure for dApps and more complex infrastructure for mobile applications, it supports push notifications, persistent sessions, and allows dApps to edit parameters such as the session duration.

 Moreover, applications can freely modify the Nightly Connect Model UI in a simple and fast manner using components prepared by us.

### dApp implementation

To take advantage of the changes, a dApp will need to implement Nightly Connect or another Wallet Adapter that is compatible with an expanded wallet standard. This can be done in two ways. The first one is to completely replace the current solution with Nightly Connect. The second is to add Nightly Connect as one of the options to the current solution.
 The entire process of implementing Nightly Connect is quick and well described in [our documentation](https://connect.nightly.app/docs/).

### Wallets implementation

For the currently existing Aptos wallets to become compatible with the extended standard and take advantage of the benefits it offers, they will need to make changes that will make them compatible with the extended standard.

To use the functions offered by Nightly Connect, such as establishing a connection through deep links and QR codes, as well as other tools, they will need to implement the code described in the [documentation](https://connect.nightly.app/docs/).
...

## Reference Implementation

Wallet Standard with wallet injecting function on [Solana](https://github.com/wallet-standard/wallet-standard) and a proposal on [Ethereum](https://eips.ethereum.org/EIPS/eip-6963).

Examples of integration of Nightly Connect on [Aleph Zero](https://aleph-zero-web3-template.nightly.app/) and [Solana](https://solana-web3-template.nightly.app/).

Demo video showing establishing a connection through [deep-links](https://twitter.com/Nightly_app/status/1729891036543975746) and [QR-codes](https://twitter.com/Nightly_app/status/1729891031385034841) by Nightly Connect.

...

## Future Potential

We aim for each dApp to utilize Nightly Connect as an Wallet Adapter, while the tools designed for mobile applications will serve as a launchpad for any new mobile app developed on Aptos.

In the future we will also work on expanding Nightly Connect as a product with features such as statistics and overall analytics.

...

## Risks and Drawbacks

After expanding the wallet standard, the implementation through wallets and Nightly Connect by dApps may take some time, which will extend the adoption time of the new solutions. However, these changes will not break or negatively impact existing solutions.

 In the case of wallets, if a wallet does not apply the changes required by the expanded Wallet Standard, Nightly Connect won't work with it.

Wallets need to migrate over to use the [new Aptos TypeScript SDK](https://github.com/aptos-labs/aptos-ts-sdk) to be compatible with both the extended wallet standard and Nightly Connect

## Timeline

### Suggested implementation timeline

1. Expansion of the Aptos Wallet Standard (5 weeks)
We'll expand the existing Aptos Wallet Standard by wallet injection and detection functions, additional methods for dApps and new interface for wallets. Everything we'll be compatible with a new [SDK](https://github.com/aptos-labs/aptos-ts-sdk).

2. Integrate Nightly Connect with Aptos (4 weeks)
Expansion of Nightly Connect on Aptos, SDK for wallets and dApps, documentation and template apps, wallet registry, and additional features for mobile like push notifications

3. Wallets implementing changes to become compatible with new wallet standard

4. dApps implementing Nightly Connect or other Wallet-Adapter that is compatible with new standard

The whole process doesn't require any action from the users.

## Suggested developer platform support timeline

We'll prepare SDKs for dApps and clients.

## Suggested deployment timeline

We'll need 6 weeks to publish it on the devnet and between 8-10 weeks to deploy it on the mainnet.

## Security Considerations

Nightly Connect, functioning as a wallet adapter, is safer than the current solution because, in comparison to it, it is not susceptible to potential supply chain attacks.

Nightly Connect, functioning as a wallet adapter, does not differ in terms of security from the currently existing Wallet Adapter.

Nightly Connect, serving as a bridge wallet for establishing connections via QR codes and deep links, potentially allows for transaction modification. However, the user will still need to approve it, and thanks to the simulation provided by most wallets, they can easily detect if the transaction has been altered.
