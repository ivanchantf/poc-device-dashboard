import React, { useState, useEffect } from 'react';
import moment from 'moment'; // Import moment

function RealTimeClock() {
  // 1. Initialize state with the current moment object
  const [currentTime, setCurrentTime] = useState(moment());

  useEffect(() => {
    // 2. Update the moment object every second
    const timer = setInterval(() => {
      setCurrentTime(moment());
    }, 1000);

    // 3. Clean up the interval on unmount
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ padding: '5px', fontFamily: 'sans-serif' }}>
      {/* <h2>Current Date & Time:</h2> */}
      {/* 4. Format the moment object using your specific string */}
      <p style={{ fontSize: '1rem', fontWeight: 'bold', color: '#333' }}>
        {currentTime.format('MMM D, YYYY, h:mm:ss A')}
      </p>
    </div>
  );
}

export default RealTimeClock;