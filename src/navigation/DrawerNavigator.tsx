import { createDrawerNavigator } from '@react-navigation/drawer';
import LoginScreen from '../screens/LoginScreen';

// const Drawer = createDrawerNavigator();

// export function DrawerNavigator() {
//   return (
//     <Drawer.Navigator>
//       <Drawer.Screen name="Account" component={LoginScreen} />
//       <Drawer.Screen name="Settings" component={LoginScreen} />
//     </Drawer.Navigator>
//   );
// }


/*
import { createDrawerNavigator } from '@react-navigation/drawer';
import InitialScreen from '../screens/InitialScreen/InitialScreen';
import AccountScreen from '../screens/AccountScreen';
import SettingsScreen from '../screens/DrawerScreen/SettingsScreen';

export type DrawerParamList = {
  Initial: undefined;
  Account: undefined;
  Settings: undefined;
};

const Drawer = createDrawerNavigator<DrawerParamList>();

export default function DrawerNavigator() {
  return (
    <Drawer.Navigator initialRouteName="Initial">
      <Drawer.Screen
        name="Initial"
        component={InitialScreen}
        options={{
          title: 'Home',
          headerShown: false,
        }}
      />

      <Drawer.Screen
        name="Account"
        component={AccountScreen}
        options={{
          title: 'Account',
        }}
      />

      <Drawer.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          headerShown: false,
        }}
      />
    </Drawer.Navigator>
  );
}

 */