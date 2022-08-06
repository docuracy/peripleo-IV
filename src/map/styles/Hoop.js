import React, {PureComponent} from 'react';

const hoopStyle = {
  cursor: 'pointer',
  fill: 'none',
  stroke: '#d00',
  strokeWidth: '2',
  transform: 'translate(0,4px)'
};

export default class Hoop extends PureComponent {
  render() {
    const {size = 20} = this.props;

    return (
      <svg
        height={size}
        style={{ ...hoopStyle }}
      	viewBox="0 -20 20 20"
      >
      	<circle cx="10" cy="-10" r="8" />
      	<circle cx="10" cy="-10" r="4" />
      </svg>
    );
  }
}
