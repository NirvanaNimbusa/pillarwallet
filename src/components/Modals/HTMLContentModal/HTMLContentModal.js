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
import Modal from 'react-native-modal';
import styled from 'styled-components/native';
import HTMLView from 'react-native-htmlview';
import { Container, ScrollWrapper } from 'components/Layout';
import Header from 'components/Header';
import Spinner from 'components/Spinner';
import type { ScrollToProps } from 'components/Modals/SlideModal';

type Props = {
  htmlEndpoint: string,
  fullScreenComponent?: ?React.Node,
  onModalHide?: Function,
  isVisible: boolean,
  modalHide: Function,
};

type State = {
  isHtmlFetched: boolean,
  htmlData: string,
  scrollOffset: ?number,
  contentContainerHeight: ?number,
  containerHeight: ?number,
};

type CustomNode = {
  name: string,
}

const LEGAL_HTML_ENDPOINT = 'https://s3.eu-west-2.amazonaws.com/pillar-prod-core-profile-images/legal/';

const ActivityIndicatorWrapper = styled.View`
  flex: 1;
  align-items: center;
  justify-content: center;
`;

const commonTextStyle = {
  color: 'black',
  fontFamily: 'Aktiv Grotesk App',
};

export default class HTMLContentModal extends React.Component<Props, State> {
  scrollViewRef: Object;

  static defaultProps = {
    fullScreenComponent: null,
  };

  constructor(props: Props) {
    super(props);
    this.scrollViewRef = React.createRef();
    this.state = {
      isHtmlFetched: false,
      htmlData: '',
      scrollOffset: undefined,
      containerHeight: undefined,
      contentContainerHeight: undefined,
    };
  }

  componentDidUpdate(prevProps: Props) {
    const { isVisible, htmlEndpoint } = this.props;
    const htmlEndpointFull = `${LEGAL_HTML_ENDPOINT}${htmlEndpoint}.html`;

    if (prevProps.isVisible !== isVisible && !!isVisible) {
      fetch(htmlEndpointFull)
        .then((resp) => { return resp.text(); })
        .then((text) => {
          this.setState({
            isHtmlFetched: true,
            htmlData: text.replace(/(\r\n\t|\n|\r\t)/gm, ''),
          });
        })
        .catch((() => {}));
    }
  }

  handleModalClose = () => {
    this.setState({ isHtmlFetched: false });
  };

  renderNode(node: CustomNode) {
    if (node.name === 'iframe' || node.name === 'script') {
      return null;
    }
    // If the function returns undefined (not null), the default renderer will be used for that node.
    return undefined;
  }

  handleScrollTo = (p: ScrollToProps) => {
    const { y } = p;
    this.scrollViewRef.props.scrollToPosition(0, y);
  };

  render() {
    const {
      isVisible,
      modalHide,
    } = this.props;
    const {
      htmlData,
      isHtmlFetched,
      scrollOffset,
      contentContainerHeight,
      containerHeight,
    } = this.state;

    const animationInTiming = 400;
    const animationOutTiming = 400;
    return (
      <Modal
        isVisible={isVisible}
        animationInTiming={animationInTiming}
        animationOutTiming={animationOutTiming}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        onBackButtonPress={modalHide}
        onModalHide={this.handleModalClose}
        scrollOffset={scrollOffset}
        onSwipeComplete={modalHide}
        scrollOffsetMax={contentContainerHeight && containerHeight ? contentContainerHeight - containerHeight : null}
        swipeDirection="down"
        scrollTo={this.handleScrollTo}
        style={{
          margin: 0,
          justifyContent: 'flex-start',
        }}
      >
        <Container>
          <Header onClose={modalHide} />
          {!isHtmlFetched &&
          <ActivityIndicatorWrapper>
            <Spinner />
          </ActivityIndicatorWrapper>
          }
          {!!isHtmlFetched &&
          <ScrollWrapper
            regularPadding
            scrollEventThrottle={16}
            onScroll={(event) => {
              const { contentOffset } = event.nativeEvent;
              const { y } = contentOffset;
              this.setState({
                scrollOffset: y,
              });
            }}
            innerRef={(ref) => { this.scrollViewRef = ref; }}
            onLayout={(event) => {
              const { height } = event.nativeEvent.layout;
              if (!containerHeight || containerHeight !== height) {
                this.setState({ containerHeight: height });
              }
            }}
            onContentSizeChange={(contentWidth, contentHeight) => {
              this.setState({ contentContainerHeight: contentHeight });
            }}
          >
            <HTMLView
              value={htmlData}
              textComponentProps={{ style: commonTextStyle }}
              renderNode={this.renderNode}
              style={{ marginBottom: 10 }}
              paragraphBreak={null}
            />
          </ScrollWrapper>
          }
        </Container>
      </Modal>
    );
  }
}

