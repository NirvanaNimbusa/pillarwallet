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

import * as React from 'react';
import styled, { withTheme } from 'styled-components/native';
import {
  TextInput,
  Keyboard,
  FlatList,
} from 'react-native';
import { connect } from 'react-redux';
import Clipboard from '@react-native-community/clipboard';
import t from 'translations/translate';

// Actions
import { addContactAction } from 'actions/contactsActions';
import { goToInvitationFlowAction } from 'actions/referralsActions';

// Components
import Button from 'components/Button';
import ContactDetailsModal from 'components/ContactDetailsModal';
import ContainerWithHeader from 'components/Layout/ContainerWithHeader';
import EmptyStateParagraph from 'components/EmptyState/EmptyStateParagraph';
import FloatingButtons from 'components/FloatingButtons';
import ListItemWithImage from 'components/ListItem/ListItemWithImage';
import Modal from 'components/Modal';
import SearchBar from 'components/SearchBar';
import SlideModal from 'components/Modals/SlideModal';

// Utils
import { spacing } from 'utils/variables';
import { getThemeColors } from 'utils/themes';
import { getMatchingSortedData } from 'utils/textInput';
import { getContactWithEnsName } from 'utils/contacts';
import { isEnsName, isValidAddress } from 'utils/validators';


// Types
import type { Dispatch } from 'redux';
import type { Theme } from 'models/Theme';
import type { Contact } from 'models/Contact';
import type { SlideModalInstance } from 'components/Modals/SlideModal';

type OwnProps = {|
  contacts?: Contact[],
  onSelectContact?: (contact: ?Contact) => mixed,
  title?: string,
  searchPlaceholder?: string,
  noImageFallback?: boolean,
  iconProps?: Object,
  validator?: (value: string) => ?string,
  allowEnteringCustomAddress?: boolean,
  allowAddContact?: boolean,
|};

type Props = {|
  ...OwnProps,
  theme: Theme,
  dispatch: Dispatch,
|};

type State = {|
  query: ?string,
  hasSearchError: boolean,
  customAddressContact: ?Contact,
  isQueryValidAddress: boolean,
  resolvingContactEnsName: boolean,
|};

const EmptyStateWrapper = styled.View`
  padding-top: 90px;
  padding-bottom: 90px;
  align-items: center;
`;

const SearchContainer = styled.View`
  flex-direction: row;
  align-items: center;
`;

const SearchBarWrapper = styled.View`
  flex: 1;
  padding-vertical: ${spacing.small}px;
  padding-start: ${spacing.layoutSides}px;
  //padding: ${spacing.mediumLarge}px ${spacing.layoutSides}px 0;
`;

const viewConfig = {
  minimumViewTime: 300,
  viewAreaCoveragePercentThreshold: 100,
  waitForInteraction: true,
};

const MIN_QUERY_LENGTH = 2;

class ContactSelectorOptions extends React.Component<Props, State> {
  searchInput: React.ElementRef<typeof TextInput>;
  modalRef = React.createRef<SlideModalInstance>();

  constructor(props: Props) {
    super(props);
    this.state = {
      query: null,
      customAddressContact: null,
      isQueryValidAddress: false,
      hasSearchError: false,
      resolvingContactEnsName: false,
    };
  }

  focusInput = () => {
    if (this.searchInput) this.searchInput.focus();
  };

  handleSearch = (query: string) => {
    const formattedQuery = !query ? '' : query.trim();
    this.setState({
      query: formattedQuery,
    });
  };

  handleInputChange = (query: string) => {
    const { allowEnteringCustomAddress } = this.props;
    this.handleSearch(query);
    if (allowEnteringCustomAddress) this.handleCustomAddress(query);
  };

  handleCustomAddress = (query: string) => {
    const isValid = isValidAddress(query);

    this.setState({
      isQueryValidAddress: isValid,
      customAddressContact: isValid && query
        ? this.getCustomAddressContact(query)
        : null,
    });
  };

  getCustomAddressContact = (address: string) => {
    let contact = { name: address, ethAddress: address };

    const { allowAddContact } = this.props;
    if (allowAddContact) {
      contact = {
        ...contact,
        buttonActionLabel: t('button.addToContacts'),
        buttonAction: () => this.handleAddToContactsPress(contact),
      };
    }

    return contact;
  };

  handlePaste = async () => {
    const clipboardValue = await Clipboard.getString();
    this.handleInputChange(clipboardValue);
  };

  handleAddToContactsPress = async (contact?: Contact) => {
    const { dispatch } = this.props;
    const { resolvingContactEnsName } = this.state;

    if (resolvingContactEnsName) return;

    const initialContact = contact ? await this.resolveContact(contact) : null;

    Modal.open(() => (
      <ContactDetailsModal
        title={t('title.addNewContact')}
        contact={initialContact}
        onSave={(savedContact: Contact) => {
          dispatch(addContactAction(savedContact));
          this.selectValue(savedContact);
          this.close();
        }}
        contacts={this.props.contacts ?? []}
        isDefaultNameEns
      />
    ));
  };

  handleInviteFriendPress = () => {
    const { dispatch } = this.props;
    dispatch(goToInvitationFlowAction());
  };

  resolveContact = async (value: Contact): Promise<?Contact> => {
    let contact: Contact = {
      name: value?.name || '',
      ethAddress: value?.ethAddress || '',
    };

    if (isEnsName(contact.ethAddress)) {
      this.setState({ resolvingContactEnsName: true });
      contact = await getContactWithEnsName(contact, contact.ethAddress);
      this.setState({ resolvingContactEnsName: false });

      // ENS name resolution failed
      if (!contact.ensName) return undefined;
    }

    if (!contact.name) {
      contact.name = contact.ethAddress;
    }

    return contact;
  };

  renderOption = ({ item: option }: Object) => {
    const { noImageFallback } = this.props;

    if (!option) return null;

    const {
      name,
      imageUrl,
      imageSource,
      opacity,
      disabled,
    } = option;

    return (
      <ListItemWithImage
        onPress={!disabled ? () => this.selectValue(option) : null}
        label={name}
        itemImageUrl={imageUrl}
        iconSource={imageSource}
        fallbackToGenericToken={!noImageFallback}
        wrapperOpacity={opacity}
        {...option}
      />
    );
  };

  close = () => {
    Keyboard.dismiss();
    if (this.modalRef.current) this.modalRef.current.close();
  };

  selectValue = async (contact: Contact) => {
    this.close();
    const resolvedContact = await this.resolveContact(contact);

    if (this.props.onSelectContact) {
      this.props.onSelectContact(resolvedContact);
    }
  };

  validateSearch = (val: string) => {
    const { validator } = this.props;
    const { hasSearchError } = this.state;
    if (!validator) return null;
    const hasError = validator(val);
    if (hasError) {
      this.setState({ hasSearchError: !!hasError });
      return hasError;
    } else if (hasSearchError) {
      this.setState({ hasSearchError: false });
    }
    return null;
  };

  handleOptionsOpen = () => {
    this.focusInput();
  };

  render() {
    const {
      theme,
      title,
      contacts = [],
      searchPlaceholder,
      iconProps = {},
      allowEnteringCustomAddress,
    } = this.props;
    const {
      query,
      customAddressContact,
      isQueryValidAddress,
      hasSearchError,
    } = this.state;
    const colors = getThemeColors(theme);
    const isSearching = query && query.length >= MIN_QUERY_LENGTH;

    const filteredContacts = isSearching ? getMatchingSortedData(contacts, query) : contacts;

    const showEmptyState = !customAddressContact && !filteredContacts?.length;
    const emptyStateMessage = (allowEnteringCustomAddress && !!query && !isQueryValidAddress)
      ? t('error.invalid.address')
      : t('label.nothingFound');

    const renderHeader = () => {
      if (!showEmptyState) return null;

      return (
        <EmptyStateWrapper fullScreen>
          <EmptyStateParagraph title={emptyStateMessage} />
        </EmptyStateWrapper>
      );
    };

    let allFeedListData = [];
    if (filteredContacts.length) {
      allFeedListData = [...filteredContacts];
    } else if (!hasSearchError && customAddressContact) {
      allFeedListData = [customAddressContact];
    }

    const buttons = [
      {
        title: t('button.addContact'),
        iconName: 'add-contact',
        onPress: () => this.handleAddToContactsPress(),
      },
      {
        title: t('button.inviteFriend'),
        iconName: 'plus',
        onPress: this.handleInviteFriendPress,
      },
    ];

    return (
      <SlideModal
        ref={this.modalRef}
        fullScreen
        onModalShow={this.handleOptionsOpen}
        noSwipeToDismiss
        noClose
        backgroundColor={colors.basic050}
        noTopPadding
      >
        <ContainerWithHeader
          headerProps={{
            noPaddingTop: true,
            customOnBack: this.close,
            centerItems: [{ title }],
          }}
        >
          <SearchContainer>
            <SearchBarWrapper>
              <SearchBar
                inputProps={{
                  onChange: this.handleInputChange,
                  value: query,
                  autoCapitalize: 'none',
                  validator: this.validateSearch,
                }}
                placeholder={searchPlaceholder}
                inputRef={(ref) => {
                  this.searchInput = ref;
                }}
                noClose
                marginBottom="0"
                iconProps={{ ...iconProps, persistIconOnFocus: true }}
              />
            </SearchBarWrapper>

            <Button onPress={this.handlePaste} title={t('button.paste')} transparent small />
          </SearchContainer>

          <FlatList
            stickyHeaderIndices={[0]}
            data={allFeedListData}
            renderItem={this.renderOption}
            keyExtractor={(contact) => contact.ethAddress || contact.name}
            keyboardShouldPersistTaps="always"
            initialNumToRender={10}
            viewabilityConfig={viewConfig}
            windowSize={10}
            hideModalContentWhileAnimating
            ListHeaderComponent={renderHeader()}
          />

          <FloatingButtons items={buttons} />
        </ContainerWithHeader>
      </SlideModal>
    );
  }
}

const ThemedSelectorOptions: React.AbstractComponent<OwnProps, ContactSelectorOptions> = withTheme(
  connect(null, null)(ContactSelectorOptions),
);
export default ThemedSelectorOptions;
