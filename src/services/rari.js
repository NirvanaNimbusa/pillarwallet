// @flow
/*
    Pillar Wallet: the personal data locker
    Copyright (C) 2019 Stiftung Pillar Project

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License along
    with this program; if not, write to the Free Software Foundation, Inc.,
    51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
*/
import { utils, BigNumber as EthersBigNumber } from 'ethers';
import maxBy from 'lodash.maxby';
import { getContract } from 'services/assets';
import { callSubgraph } from 'services/theGraph';
import { getCoinGeckoTokenPrices } from 'services/coinGecko';
import { getEnv, getRariPoolsEnv } from 'configs/envConfig';
import { reportErrorLog } from 'utils/common';
import { RARI_POOLS_ARRAY, RARI_POOLS, RARI_GOVERNANCE_TOKEN_DATA } from 'constants/rariConstants';
import { ETH } from 'constants/assetsConstants';
import RARI_FUND_MANAGER_CONTRACT_ABI from 'abi/rariFundManager.json';
import ERC20_CONTRACT_ABI from 'abi/erc20.json';
import RARI_FUND_TOKEN_CONTRACT_ABI from 'abi/rariFundToken.json';
import RARI_RGT_DISTRIBUTOR_CONTRACT_ABI from 'abi/rariGovernanceTokenDistributor.json';
import type { RariPool } from 'models/RariPool';
import type { Rates } from 'models/Asset';

const hasEthUsdPrice = (rates: Rates) => !!rates?.[ETH]?.USD;

const mapPools = (resultsArray: Object[]) => {
  return RARI_POOLS_ARRAY.reduce((result, pool, i) => {
    result[pool] = resultsArray[i];
    return result;
  }, {});
};

export const getRariFundBalanceInUSD = async (rates: Rates) => {
  const balancePerPool = await Promise.all(RARI_POOLS_ARRAY.map(async rariPool => {
    const rariContract = getContract(
      getRariPoolsEnv(rariPool).RARI_FUND_MANAGER_CONTRACT_ADDRESS,
      RARI_FUND_MANAGER_CONTRACT_ABI,
    );
    if (!rariContract) return EthersBigNumber.from(0);
    let balance = await rariContract.callStatic.getFundBalance()
      .catch((error) => {
        reportErrorLog("Rari service failed: Can't get Rari fund balance", { error });
        return EthersBigNumber.from(0);
      });
    if (rariPool === RARI_POOLS.ETH_POOL) {
      // if ETH USD price is not within rates we cannot do anything – return 0
      if (!hasEthUsdPrice(rates)) return EthersBigNumber.from(0);

      balance = EthersBigNumber.from(balance).mul(Math.floor(rates[ETH].USD * 1e9)).div(1e9);
    }
    return parseFloat(utils.formatUnits(balance, 18));
  }));
  return mapPools(balancePerPool);
};

export const getRariTokenTotalSupply = async () => {
  const supplyPerPool = await Promise.all(RARI_POOLS_ARRAY.map(async rariPool => {
    const rariContract = getContract(
      getRariPoolsEnv(rariPool).RARI_FUND_TOKEN_ADDRESS,
      RARI_FUND_TOKEN_CONTRACT_ABI,
    );
    if (!rariContract) return EthersBigNumber.from(0);
    const supply = await rariContract.totalSupply()
      .catch(error => {
        reportErrorLog("Rari service failed: Can't get Rari token supply", { error });
        return '0';
      });
    return parseFloat(utils.formatUnits(supply, 18));
  }));
  return mapPools(supplyPerPool);
};

export const getAccountDepositBN = async (rariPool: RariPool, accountAddress: string) => {
  const rariContract = getContract(
    getRariPoolsEnv(rariPool).RARI_FUND_MANAGER_CONTRACT_ADDRESS,
    RARI_FUND_MANAGER_CONTRACT_ABI,
  );
  if (!rariContract) return EthersBigNumber.from(0);
  const balanceBN = await rariContract.callStatic.balanceOf(accountAddress)
    .catch((error) => {
      reportErrorLog("Rari service failed: Can't get user account deposit in USD", { error });
      return EthersBigNumber.from(0);
    });
  return balanceBN;
};

export const getAccountDeposit = async (accountAddress: string) => {
  const depositPerPool = await Promise.all(RARI_POOLS_ARRAY.map(async (rariPool) => {
    const balanceBN = await getAccountDepositBN(rariPool, accountAddress);
    return parseFloat(utils.formatUnits(balanceBN, 18));
  }));
  return mapPools(depositPerPool);
};

export const getAccountDepositInUSDBN = async (rariPool: RariPool, accountAddress: string, rates: Rates) => {
  const rariContract = getContract(
    getRariPoolsEnv(rariPool).RARI_FUND_MANAGER_CONTRACT_ADDRESS,
    RARI_FUND_MANAGER_CONTRACT_ABI,
  );
  if (!rariContract) return EthersBigNumber.from(0);
  let balanceBN = await rariContract.callStatic.balanceOf(accountAddress)
    .catch((error) => {
      reportErrorLog("Rari service failed: Can't get user account deposit in USD", { error });
      return EthersBigNumber.from(0);
    });
  if (rariPool === RARI_POOLS.ETH_POOL) {
    // if ETH USD price is not within rates we cannot do anything – return 0
    if (!hasEthUsdPrice(rates)) return EthersBigNumber.from(0);

    balanceBN = balanceBN.mul(Math.floor(rates[ETH].USD * 1e9)).div(1e9);
  }
  return balanceBN;
};

export const getAccountDepositInUSD = async (accountAddress: string, rates: Rates) => {
  const depositPerPool = await Promise.all(RARI_POOLS_ARRAY.map(async (rariPool) => {
    const balanceBN = await getAccountDepositInUSDBN(rariPool, accountAddress, rates);
    return parseFloat(utils.formatUnits(balanceBN, 18));
  }));
  return mapPools(depositPerPool);
};

export const getAccountDepositInPoolToken = async (accountAddress: string) => {
  const depositPerPool = await Promise.all(RARI_POOLS_ARRAY.map(async (rariPool) => {
    const rariContract = getContract(
      getRariPoolsEnv(rariPool).RARI_FUND_TOKEN_ADDRESS,
      ERC20_CONTRACT_ABI,
    );
    if (!rariContract) return 0;
    const balanceBN = await rariContract.balanceOf(accountAddress)
      .catch((error) => {
        reportErrorLog("Rari service failed: Can't get user account deposit in RSPT", { error });
        return 0;
      });
    return parseFloat(utils.formatUnits(balanceBN, 18));
  }));
  return mapPools(depositPerPool);
};

export const getUserInterests = async (accountAddress: string, rates: Rates) => {
  const userBalanceUSD = await getAccountDeposit(accountAddress);
  const userBalanceInPoolToken = await getAccountDepositInPoolToken(accountAddress);

  const interestsPerPool = await Promise.all(RARI_POOLS_ARRAY.map(async (rariPool) => {
    if (!userBalanceInPoolToken[rariPool] || !userBalanceUSD[rariPool]) return null;

    /* eslint-disable i18next/no-literal-string */
    const query = `{
    transfersOut: transfers(where: {
      from: "${accountAddress}", 
      tokenAddress: "${getRariPoolsEnv(rariPool).RARI_FUND_TOKEN_ADDRESS}"
    }) {
      amount
      amountInUSD
      timestamp
    }
    transfersIn: transfers(where: {
      to: "${accountAddress}", 
      tokenAddress: "${getRariPoolsEnv(rariPool).RARI_FUND_TOKEN_ADDRESS}"
    }) {
      amount
      amountInUSD
      timestamp
    }
  }
  `;
    /* eslint-enable i18next/no-literal-string */
    const transactions = await callSubgraph(getEnv().RARI_SUBGRAPH_NAME, query);
    if (!transactions) return null;

    // From Rari docs:
    // "Get my interest accrued: Subtract total deposits and transfers in (in USD) and add total withdrawals
    // and transfers out (in USD) from uint256 RariFundManager.balanceOf(address account)."
    //
    // But in order to calculate the interest percentage we "reset" the interests gained on the last transfer
    // Aave calculates interest in the same way

    const lastTransfer = maxBy([...transactions.transfersIn, ...transactions.transfersOut], tx => +tx.timestamp);
    if (!lastTransfer) return null;
    const rsptExchangeRateOnLastTransfer = lastTransfer.amountInUSD / lastTransfer.amount;
    const initialBalance = userBalanceInPoolToken[rariPool] * rsptExchangeRateOnLastTransfer;
    let interests = userBalanceUSD[rariPool] - initialBalance;
    const interestsPercentage = (interests / initialBalance) * 100;
    if (rariPool === RARI_POOLS.ETH_POOL) {
      // if ETH USD price is not within rates we cannot do anything – return 0
      if (!hasEthUsdPrice(rates)) return EthersBigNumber.from(0);

      // interests in ETH pool are in ETH - convert them to
      const interestsBN = EthersBigNumber.from(Math.floor(interests * 1e9)).mul(Math.floor(rates[ETH].USD * 1e9));
      interests = parseFloat(utils.formatUnits(interestsBN));
    }
    return { interests, interestsPercentage };
  }));
  return mapPools(interestsPerPool);
};

export const getUserRgtBalance = async (accountAddress: string) => {
  const rariContract = getContract(
    getEnv().RARI_GOVERNANCE_TOKEN_CONTRACT_ADDRESS,
    ERC20_CONTRACT_ABI,
  );
  if (!rariContract) return null;
  const balance = await rariContract.balanceOf(accountAddress)
    .catch((error) => {
      reportErrorLog("Rari service failed: Can't get user RGT balance", { error });
      return null;
    });
  return parseFloat(utils.formatUnits(balance, 18));
};

export const getUnclaimedRgt = async (accountAddress: string) => {
  const rariContract = getContract(
    getEnv().RARI_RGT_DISTRIBUTOR_CONTRACT_ADDRESS,
    RARI_RGT_DISTRIBUTOR_CONTRACT_ABI,
  );
  if (!rariContract) return null;
  const amount = await rariContract.getUnclaimedRgt(accountAddress)
    .catch((error) => {
      reportErrorLog("Rari service failed: Can't get user unclaimed RGT", { error });
      return null;
    });
  return parseFloat(utils.formatUnits(amount, 18));
};

export const getRtgPrice = async () => {
  const price = await getCoinGeckoTokenPrices({
    // $FlowFixMe: react-native types
    [RARI_GOVERNANCE_TOKEN_DATA.symbol]: RARI_GOVERNANCE_TOKEN_DATA,
  });
  if (!price) return null;
  return price[RARI_GOVERNANCE_TOKEN_DATA.symbol];
};

export const getRtgSupply = async () => {
  const rariContract = getContract(
    getEnv().RARI_GOVERNANCE_TOKEN_CONTRACT_ADDRESS,
    ERC20_CONTRACT_ABI,
  );
  if (!rariContract) return null;
  const balance = await rariContract.totalSupply()
    .catch((error) => {
      reportErrorLog("Rari service failed: Can't get RGT total supply", { error });
      return null;
    });
  return parseFloat(utils.formatUnits(balance, 18));
};
