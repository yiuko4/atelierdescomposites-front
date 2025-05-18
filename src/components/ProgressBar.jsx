import React from 'react';

const ProgressBar = ({ percentage, message, isError }) => {
  const containerStyles = {
    height: 25, // Slightly taller
    width: '100%',
    backgroundColor: "#e0e0de",
    borderRadius: 50,
    margin: '20px 0' // More margin
  };

  const fillerStyles = {
    height: '100%',
    width: `${percentage}%`,
    backgroundColor: isError ? '#dc3545' : '#007bff', // Red for error, blue for normal
    borderRadius: 'inherit',
    textAlign: 'right',
    transition: 'width 0.3s ease-in-out, background-color 0.3s ease-in-out' // Added transition for bg color
  };

  const labelStyles = {
    padding: 5,
    color: percentage > 40 || isError ? 'white' : 'black', // Adjust label color for visibility
    fontWeight: 'bold',
    fontSize: '0.9em' // Slightly smaller font
  };

  return (
    <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
      <div style={containerStyles}>
        <div style={fillerStyles}>
          <span style={labelStyles}>{`${percentage}%`}</span>
        </div>
      </div>
      {message && <p style={{ textAlign: 'center', marginTop: '8px', color: isError ? '#dc3545' : 'inherit' }}>{message}</p>}
    </div>
  );
};

export default ProgressBar; 