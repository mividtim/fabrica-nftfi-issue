import { Alchemy } from 'alchemy-sdk'
import dotenv from 'dotenv'
import NftFi from '@nftfi/js'

dotenv.config()

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY
const ALCHEMY_NETWORK_NAME = process.env.ALCHEMY_NETWORK_NAME
const FABRICA_V3_CONTRACT_ADDRESS = process.env.FABRICA_V3_CONTRACT_ADDRESS
const FABRICA_V3_TOKEN_ID = process.env.FABRICA_V3_TOKEN_ID
const FABRICA_V3_TOKEN_HOLDER_ADDRESS = process.env.FABRICA_V3_TOKEN_HOLDER_ADDRESS
const LENDER_PRIVATE_KEY = process.env.LENDER_PRIVATE_KEY
const LENDER_WALLET_ADDRESS = process.env.LENDER_WALLET_ADDRESS
const NFTFI_API_KEY = process.env.NFTFI_API_KEY
const USDC_CONTRACT_ADDRESS = process.env.USDC_CONTRACT_ADDRESS

const NftfiLoanContract = {
  FixedV1: 'v1.loan.fixed',
  FixedV2: 'v2.loan.fixed',
  FixedV2_1: 'v2-1.loan.fixed',
  FixedCollectionV2: 'v2.loan.fixed.collection',
}

const createOffer = async () => {
  const terms = {
    currency: USDC_CONTRACT_ADDRESS,
    // 1 USDC
    principal: 1_000_000,
    // 1.1 USDC
    repayment: 1_100_000,
    // 6 months
    duration: 604_800,
    // 7 days
    expiry: 21_600,
  }
  const alchemyClient = new Alchemy({
    apiKey: ALCHEMY_API_KEY,
    network: ALCHEMY_NETWORK_NAME,
  })
  const provider = await alchemyClient.config.getProvider()
  const nftfi = await NftFi.init({
    config: { api: { key: NFTFI_API_KEY } },
    ethereum: {
      account: { privateKey: `0x${LENDER_PRIVATE_KEY}` },
      provider: { url: provider.connection.url },
    },
  })
  const lenderBalance = await nftfi.erc20.balanceOf({
    account: { address: LENDER_WALLET_ADDRESS },
    token: { address: terms.currency },
  })
  if (BigInt(lenderBalance) < BigInt(terms.principal)) {
    throw new Error(`Lender balance of ${lenderBalance} is lower than principal amount of ${terms.principal}`)
  }
  await nftfi.erc20.approve({
    amount: terms.principal,
    token: { address: terms.currency },
    nftfi: { contract: { name: NftfiLoanContract.FixedV2_1 } },
  })
  const createOffer = {
    terms,
    nft: {
      address: FABRICA_V3_CONTRACT_ADDRESS,
      id: FABRICA_V3_TOKEN_ID,
    },
    borrower: { address: FABRICA_V3_TOKEN_HOLDER_ADDRESS },
    nftfi: { contract: { name: NftfiLoanContract.FixedV2_1 } },
  }
  console.debug('Creating NFTfi offer...', createOffer)
  const response = await nftfi.offers.create(createOffer)
  if (response.code && response.code >= 400) {
    throw new Error(`Error creating offer: HTTP ${response.code} ${response.message}`)
  }
  if (response.errors != null &&
      typeof response.errors === 'object' &&
      !Array.isArray(response.errors)
  ) {
    const [firstCode, firstError] = Object.entries(response.errors)[0]
    const message =
      Array.isArray(firstError) && typeof firstError[0] === 'string'
        ? `Error creating offer: ${firstCode}: ${firstError[0]}`
        : 'Unknown error creating offer'
    console.error(message, response)
    throw new Error(message)
  }
  const { result } = response
  console.debug('Offer successfully created', result)
}


createOffer()
  .catch((error) => {
    console.error(error)
    throw error
  })
  .then(() => process.exit(0))
  .catch((error) => {
    throw error
  })

