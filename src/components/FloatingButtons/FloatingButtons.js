// @flow
/*
    Pillar Wallet: the personal data locker
    Copyright (C) 2021 Stiftung Pillar Project

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

import * as React from 'react';
import styled from 'styled-components/native';

// Components
import { BaseText } from 'components/Typography';

// Utils
import { compactFalsy } from 'utils/common';
import { spacing } from 'utils/variables';

// Types
import type { ImageSource } from 'utils/types/react-native';

export type Item = {|
    title: string,
    iconSource?: ImageSource;
    onPress?: () => void;
|}

type Props = {|
  items: (?Item | false)[],
|};

const FloatingButtons = ({ items: falsyItems }: Props) => {
  const items = compactFalsy(falsyItems);

  if (items.length === 0) {
    return null;
  }

  return (
    <Container>
      {items.map((item) => (
        <ItemView key={item.title} onPress={item.onPress} testID="FloatingButtonItem">
          <ItemIcon source={item.iconSource} resizeMode="contain" />
          <ItemTitle>{item.title}</ItemTitle>
        </ItemView>
      ))}
    </Container>
  );
};

export default FloatingButtons;

const Container = styled.View`
  position: absolute;
  bottom: 32px;
  flex-direction: row;
  align-self: center;
  align-items: center;
  padding-horizontal: ${spacing.large / 2}px;
  background-color: ${({ theme }) => theme.colors.basic050};
  border-radius: 20px;
  shadow-opacity: 0.05;
  shadow-color: #000;
  shadow-offset: 0 8px;
  shadow-radius: 16px;
`;

const ItemView = styled.TouchableOpacity`
  align-items: center;
  padding-horizontal: ${spacing.extraLarge / 2}px;
  padding-top: ${spacing.mediumLarge}px;
  padding-bottom: ${spacing.medium}px;
`;

const ItemIcon = styled.Image.attrs(({ theme }) => ({ tintColor: theme.colors.basic010 }))`
  flex: 1;
  margin-horizontal: ${spacing.extraLarge}px;
  tint-color: ${({ theme }) => theme.colors.basic010};
`;

const ItemTitle = styled(BaseText).attrs({ regular: true })`
  margin-top: ${spacing.extraSmall}px;
  text-align: center;
`;
