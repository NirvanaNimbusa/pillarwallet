// @flow
import 'utils/setup';
import * as React from 'react';
import { StatusBar, BackHandler, NetInfo } from 'react-native';
import SplashScreen from 'react-native-splash-screen';
import { NavigationActions } from 'react-navigation';
import { Root as NBRoot, Toast } from 'native-base';
import { showToast } from 'utils/toast';
import { Provider, connect } from 'react-redux';
import { reduxifyNavigator } from 'react-navigation-redux-helpers';
import RootNavigation from 'navigation/rootNavigation';
import { initAppAndRedirectAction } from 'actions/appActions';
import configureStore from './src/configureStore';

const store = configureStore();
const ReduxifiedRootNavigation = reduxifyNavigator(RootNavigation, 'root');

type Props = {
  dispatch: Function,
  navigation: Object,
  isFetched: Boolean,
  fetchAppSettingsAndRedirect: Function,
}

class App extends React.Component<Props, *> {
  componentWillUnmount() {
    BackHandler.removeEventListener('hardwareBackPress', this.onBackPress);
    NetInfo.isConnected.removeEventListener('connectionChange', this.handleConnectivityChange);
  }

  async componentDidMount() {
    const { fetchAppSettingsAndRedirect } = this.props;
    SplashScreen.hide();
    fetchAppSettingsAndRedirect();
    StatusBar.setBarStyle('dark-content');
    BackHandler.addEventListener('hardwareBackPress', this.onBackPress);
    NetInfo.isConnected.addEventListener('connectionChange', this.handleConnectivityChange);
  }


  onBackPress = () => {
    const { dispatch, navigation } = this.props;
    const { routes, index } = navigation;
    if (routes[index].index === 0) {
      return false;
    }
    dispatch(NavigationActions.back());
    return true;
  };

  handleConnectivityChange = isOnline => {
    if (!isOnline) {
      showToast({ text: 'No active internet connection found!', type: 'danger', duration: 0 }, true);
    } else {
      Toast.hide();
    }
  };

  render() {
    const { navigation, dispatch, isFetched } = this.props;
    if (!isFetched) return null;

    return (
      <ReduxifiedRootNavigation state={navigation} dispatch={dispatch} />
    );
  }
}

const mapStateToProps = ({ navigation, appSettings: { isFetched } }) => ({
  navigation,
  isFetched,
});

const mapDispatchToProps = (dispatch) => ({
  dispatch,
  fetchAppSettingsAndRedirect: () => dispatch(initAppAndRedirectAction()),
});

const AppWithNavigationState = connect(mapStateToProps, mapDispatchToProps)(App);

const Root = () => (
  <NBRoot>
    <Provider store={store}>
      <AppWithNavigationState />
    </Provider>
  </NBRoot>
);

export default Root;
