function Profile() {
  const user = {
    name: 'Samrat Ghodge',
    email: localStorage.getItem('ea_user') || 'student@university.edu',
    university: 'University of Technology',
    department: 'Computer Science & Engineering',
    year: 'Final Year (B.Tech)',
    joined: 'August 2026',
  };

  return (
    <div>
      <h1 className="page-title">Profile</h1>

      <div className="profile-card">
        <div className="avatar-placeholder">
          {user.name.split(' ').map((n) => n[0]).join('')}
        </div>

        <div className="info-row">
          <div className="info-label">Name</div>
          <div className="info-value">{user.name}</div>
        </div>
        <div className="info-row">
          <div className="info-label">Email</div>
          <div className="info-value">{user.email}</div>
        </div>
        <div className="info-row">
          <div className="info-label">University</div>
          <div className="info-value">{user.university}</div>
        </div>
        <div className="info-row">
          <div className="info-label">Department</div>
          <div className="info-value">{user.department}</div>
        </div>
        <div className="info-row">
          <div className="info-label">Year</div>
          <div className="info-value">{user.year}</div>
        </div>
        <div className="info-row">
          <div className="info-label">Member Since</div>
          <div className="info-value">{user.joined}</div>
        </div>

        <hr className="section-divider" />

        <button className="btn-primary" style={{ marginRight: '10px' }}>Edit Profile</button>
        <button className="btn-secondary">Change Password</button>
      </div>
    </div>
  );
}

export default Profile;
