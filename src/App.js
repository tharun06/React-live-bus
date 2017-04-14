import React, { Component } from 'react';
import { compose, withState, withHandlers, lifecycle } from 'recompose';
import config from './config';
import RTM from 'satori-sdk-js';
import { values, uniq, clone } from 'lodash';
import BusMap from './BusMap';

import 'normalize.css';
import './App.css';

const App = ({ state, onVehicleSelect, onRouteSelect }) => (
  <div id="container">
    <div id="buses">
      <table>
        <thead>
          <tr>
            <th className="wide">Route name</th>
            <th>Buses on route</th>
          </tr>
        </thead>
        <tbody>
          {values(state.routes).map(({ id, title, vehicles }) => (
            <tr
              key={id}
              onClick={() => onRouteSelect(id)}
              className={state.selectedRoute === id ? 'selected' : ''}
            >
              <td>{title}</td>
              <td className="center">{vehicles.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {state.selectedRoute
        ? <div className="show-all" onClick={() => onRouteSelect(undefined)}>
            Show all buses
          </div>
        : null}
    </div>
    <div id="map">
      <BusMap
        center={{ lat: 42.373093, lng: -71.117714 }}
        markers={(state.selectedRoute
          ? state.routes[state.selectedRoute].vehicles.map(
              id => state.vehicles[id]
            )
          : values(state.vehicles)).map(({ vehicle: { id, label }, position }) => ({
          id,
          position,
          title: label
        }))}
        onVehicleSelect={onVehicleSelect}
      />
    </div>
  </div>
);

// this app really does not need to setup redux
// so I use just basic state handling
export const enhance = compose(
  withState('state', 'setState', {
    routes: {},
    vehicles: {},
  }),
  withHandlers({
    onVehicleSelect: ({ state, setState }) => id =>
      setState({
        ...state,
        selectedRoute: state.vehicles[id].trip.route_id,
      }),

    onRouteSelect: ({ state, setState }) => id =>
      setState({
        ...state,
        selectedRoute: id,
      }),

    receiveMessage: ({ state, setState }) => entities => {
      // loop through all received buses locations
      const routes = clone(state.routes);
      const vehicles = clone(state.vehicles);

      // normal loop is used because of the performance
      // more idiomatic would be entities.reduce(), with
      // pseudo-immutable objects
      for (let j = 0; j < entities.length; j++) {
        const i = entities[j];

        if (!i.vehicle.trip) continue;

        const id = i.id.split('_')[1];
        const routeId = i.vehicle.trip.route_id;
        const vehiclesOnRoute = routes[routeId] ? routes[routeId].vehicles : [];

        routes[routeId] = {
          id: routeId,
          // this is provider specific
          title: routeId,
          vehicles: vehiclesOnRoute.indexOf(id) == -1
            ? [...vehiclesOnRoute, id]
            : vehiclesOnRoute,
        };

        vehicles[id] = {
          ...i.vehicle,
          id,
          position: {
            lat: i.vehicle.position.latitude,
            lng: i.vehicle.position.longitude,
          },
        };
      }

      window.routes = routes;

      setState({
        ...state,
        routes,
        vehicles,
      });
    },
  }),
  lifecycle({
    componentDidMount() {
      // setup new rtm subscribe on data
      this.rtm = new RTM(config.satori.endpoint, config.satori.apiKey);

      this.rtm.on('enter-connected', () =>
        console.debug('Succesfully connected to RTM :)')
      );

      const subscription = this.rtm.subscribe(
        'transportation',
        RTM.SubscriptionMode.SIMPLE,
        {
          filter: "select * from `transportation` where header.`user-data`='mbta'",
        }
      );

      subscription.on('rtm/subscription/data', pdu => {
        const entities = pdu.body.messages.reduce((p, { entity }) => {
          p.push.apply(p, entity);

          return p;
        }, []);

        this.props.receiveMessage(entities);
      });

      this.rtm.start();
    },

    componentWillUnmount() {
      this.rtm.stop();
    },
  })
);

export default enhance(App);
