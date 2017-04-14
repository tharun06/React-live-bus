/*global google*/
import React, { Component } from 'react';

// compute diff of two arrays of buses
function getDiff(a, b) {
  const objA = {};
  const objB = {};
  const keysA = [];
  const added = [];
  const removed = [];
  const changed = [];
  const equal = [];

  for (let i = 0; i < a.length; i++) {
    objA[a[i].id] = a[i];
    keysA.push(a[i].id);
  }

  for (let i = 0; i < b.length; i++) {
    objB[b[i].id] = b[i];
  }

  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i];
    const oa = objA[key];
    const ob = objB[key];

    if (objB[key] !== undefined) {
      // thanks to the fixed structure of the data, we can easily check if the object are same
      if (
        !(oa === ob ||
          (oa.id === ob.id &&
            (oa.position === ob.position ||
              (oa.position.lat === ob.position.lat &&
                oa.position.lng === ob.position.lng))))
      ) {
        changed.push(ob);
      } else {
        equal.push(ob);
      }

      delete objB[key];
    } else {
      removed.push(oa);
    }
  }

  const keysB = Object.keys(objB);

  for (let i = 0; i < keysB.length; i++) {
    added.push(objB[keysB[i]]);
  }

  return { added, changed, removed, equal };
}

// this component is using 3rd party library google maps,
// react 3rd party solutions were laggy, when have on the map appeared
// more than 200 buses
// just mention, that state is not used, because state does not
// belong to react
class BusMap extends Component {
  constructor(props) {
    super(props);

    this.markers = {};
    this.map = null;
    this.onMapNode = this.onMapNode.bind(this);
  }

  refreshMarkers(oldMarkers, newMarkers) {
    if (this.map == null) return;

    const { added, changed, removed, equal } = getDiff(oldMarkers, newMarkers);

    // create new marker and add listener to it for all added markers
    for (let i = 0; i < added.length; i++) {
      if (this.markers[added[i].id]) {
        this.markers[added[i].id].setMap(this.map);
        this.markers[added[i].id].setPosition(added[i].position);
      } else {
        this.markers[added[i].id] = new google.maps.Marker({
          position: added[i].position,
          map: this.map,
          title: added[i].title,
        });

        this.markers[added[i].id].addListener(
          'click',
          this.onMarkerClick.bind(this, added[i].id)
        );
      }
    }

    // do not copy the marker, set map to null and unbind all listeners
    for (let i = 0; i < removed.length; i++) {
      // do not delete the marker, because we may to reuse it later
      this.markers[removed[i].id].setMap(null);
      this.markers[removed[i].id].unbindAll();
    }

    // update changed markers
    for (let i = 0; i < changed.length; i++) {
      this.markers[changed[i].id].setMap(this.map);
      this.markers[changed[i].id].setPosition(changed[i].position);
    }

    this.forceUpdate();
  }

  onMapNode(node) {
    this.map = new google.maps.Map(node, {
      zoom: 11,
      center: this.props.center,
    });

    this.refreshMarkers([], this.props.markers);
  }

  onMarkerClick(id) {
    this.props.onVehicleSelect(id);
  }

  componentWillReceiveProps({ markers: newMarkers }) {
    this.refreshMarkers(this.props.markers, newMarkers);
  }

  render() {
    return <div ref={this.onMapNode} className="map" />;
  }
}

export default BusMap;
