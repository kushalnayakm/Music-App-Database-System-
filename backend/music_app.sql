CREATE DATABASE music_app;
USE music_app;
CREATE TABLE SubscriptionPlan (
  SubscriptionPlanID INT AUTO_INCREMENT PRIMARY KEY,
  Name VARCHAR(50) NOT NULL,
  Price DECIMAL(8,2) NOT NULL,
  Description TEXT
);
SHOW TABLES;
CREATE TABLE PremiumFeature (
  PremiumFeatureID INT AUTO_INCREMENT PRIMARY KEY,
  Name VARCHAR(100) NOT NULL
);
SHOW TABLES;
CREATE TABLE PlanFeature (
  SubscriptionPlanID INT NOT NULL,
  PremiumFeatureID INT NOT NULL,
  PRIMARY KEY (SubscriptionPlanID, PremiumFeatureID),
  FOREIGN KEY (SubscriptionPlanID) REFERENCES SubscriptionPlan(SubscriptionPlanID) ON DELETE CASCADE,
  FOREIGN KEY (PremiumFeatureID) REFERENCES PremiumFeature(PremiumFeatureID) ON DELETE CASCADE
);
CREATE TABLE UserAccount (
  UserID INT AUTO_INCREMENT PRIMARY KEY,
  Username VARCHAR(50) NOT NULL,
  Email VARCHAR(100) NOT NULL UNIQUE,
  Password VARCHAR(255) NOT NULL,
  SubscriptionPlanID INT,
  CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (SubscriptionPlanID) REFERENCES SubscriptionPlan(SubscriptionPlanID)
);
CREATE TABLE Artist (
  ArtistID INT AUTO_INCREMENT PRIMARY KEY,
  Name VARCHAR(100) NOT NULL,
  Genre VARCHAR(50)
);
CREATE TABLE Album (
  AlbumID INT AUTO_INCREMENT PRIMARY KEY,
  Title VARCHAR(150) NOT NULL,
  ArtistID INT NOT NULL,
  ReleaseDate DATE,
  FOREIGN KEY (ArtistID) REFERENCES Artist(ArtistID) ON DELETE CASCADE
);
CREATE TABLE Track (
  TrackID INT AUTO_INCREMENT PRIMARY KEY,
  Title VARCHAR(150) NOT NULL,
  ArtistID INT NOT NULL,
  AlbumID INT,
  Duration TIME,
  ReleaseDate DATE,
  FOREIGN KEY (ArtistID) REFERENCES Artist(ArtistID),
  FOREIGN KEY (AlbumID) REFERENCES Album(AlbumID) ON DELETE SET NULL
);
CREATE TABLE Playlist (
  PlaylistID INT AUTO_INCREMENT PRIMARY KEY,
  UserID INT NOT NULL,
  Title VARCHAR(150) NOT NULL,
  CreationDate DATE DEFAULT (CURRENT_DATE),
  ParentPlaylistID INT,
  FOREIGN KEY (UserID) REFERENCES UserAccount(UserID) ON DELETE CASCADE,
  FOREIGN KEY (ParentPlaylistID) REFERENCES Playlist(PlaylistID) ON DELETE SET NULL
);
CREATE TABLE TrackPlaylist (
  PlaylistID INT NOT NULL,
  TrackID INT NOT NULL,
  OrderNum INT NOT NULL,
  PRIMARY KEY (PlaylistID, TrackID),
  FOREIGN KEY (PlaylistID) REFERENCES Playlist(PlaylistID) ON DELETE CASCADE,
  FOREIGN KEY (TrackID) REFERENCES Track(TrackID) ON DELETE CASCADE
);
CREATE TABLE Likes (
  UserID INT NOT NULL,
  TrackID INT NOT NULL,
  LikedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (UserID, TrackID),
  FOREIGN KEY (UserID) REFERENCES UserAccount(UserID) ON DELETE CASCADE,
  FOREIGN KEY (TrackID) REFERENCES Track(TrackID) ON DELETE CASCADE
);
CREATE TABLE Payment (
  PaymentID INT AUTO_INCREMENT PRIMARY KEY,
  UserID INT NOT NULL,
  Amount DECIMAL(8,2) NOT NULL,
  Date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  Method VARCHAR(50),
  FOREIGN KEY (UserID) REFERENCES UserAccount(UserID) ON DELETE CASCADE
);
SHOW TABLES;
INSERT INTO SubscriptionPlan (Name, Price, Description)
VALUES ('Free', 0.00, 'Basic plan with ads'),
       ('Premium', 199.99, 'Ad-free listening with offline mode');
INSERT INTO PremiumFeature (Name)
VALUES ('Ad-free listening'), ('Offline downloads'), ('High-quality audio');
INSERT INTO PlanFeature (SubscriptionPlanID, PremiumFeatureID)
VALUES 
(2, 1),  -- Premium plan has Ad-free listening
(2, 2),  -- Premium plan has Offline downloads
(2, 3);  -- Premium plan has High-quality audio
INSERT INTO UserAccount (Username, Email, Password, SubscriptionPlanID)
VALUES 
('Kushal', 'kushal@example.com', 'hashedpassword', 2),  -- Premium user
('Neha', 'neha@example.com', 'hashedpassword', 1);    -- Free user
INSERT INTO Track (Title, ArtistID, AlbumID, Duration, ReleaseDate)
VALUES 
('Yellow', 1, 1, '00:04:26', '2000-06-26'),  
('Hello', 2, 2, '00:04:55', '2015-10-23');    
INSERT INTO Likes (UserID, TrackID)
VALUES 
(1, 2),  -- kushal likes "Hello"
(2, 1);  -- Neha likes "Yellow"
INSERT INTO Artist (Name, Genre)
VALUES 
('Coldplay', 'Pop Rock'),
('Adele', 'Soul');
INSERT INTO Album (Title, ArtistID, ReleaseDate)
VALUES 
('Parachutes', 1, '2000-07-10'),  -- ArtistID 1 = Coldplay
('25', 2, '2015-11-20');          -- ArtistID 2 = Adele
INSERT INTO Track (Title, ArtistID, AlbumID, Duration, ReleaseDate)
VALUES 
('Yellow', 1, 1, '00:04:26', '2000-06-26'),  -- Coldplay, Parachutes
('Hello', 2, 2, '00:04:55', '2015-10-23');   -- Adele, 25
INSERT INTO Likes (UserID, TrackID)
VALUES 
(1, 2),  -- Kushal likes "Hello"
(2, 1);  -- Neha likes "Yellow"
SELECT * FROM UserAccount;
SELECT * FROM Track;
INSERT INTO Likes (UserID, TrackID)
VALUES 
(1, 4),  -- Kushal likes "Hello"
(2, 3);  -- Neha likes "Yellow"
INSERT INTO Payment (UserID, Amount, Method)
VALUES 
(1, 199.99, 'Credit Card'),  -- Kushal’s Premium subscription
(2, 0.00, 'Free');           -- Neha’s Free subscription
SELECT * FROM SubscriptionPlan;
SELECT * FROM PremiumFeature;
SELECT * FROM PlanFeature;
SELECT * FROM UserAccount;
SELECT * FROM Artist;
SELECT * FROM Album;
SELECT * FROM Track;
SELECT * FROM Playlist;
SELECT * FROM TrackPlaylist;
SELECT * FROM Likes;
SELECT * FROM Payment;
INSERT INTO Playlist (UserID, Title)
VALUES 
(1, 'My Favorites'),  -- Kushal's playlist
(2, 'Chill Vibes');   -- Neha's playlist
SELECT * FROM Playlist;
SELECT * FROM UserAccount;
SELECT * FROM SubscriptionPlan;
SELECT * FROM Track;
SELECT * FROM Playlist;
SELECT U.Username, SP.Name AS PlanName
FROM UserAccount U
JOIN SubscriptionPlan SP ON U.SubscriptionPlanID = SP.SubscriptionPlanID;
SELECT P.Title AS PlaylistName, T.Title AS TrackTitle, TP.OrderNum
FROM TrackPlaylist TP
JOIN Playlist P ON TP.PlaylistID = P.PlaylistID
JOIN Track T ON TP.TrackID = T.TrackID
ORDER BY P.PlaylistID, TP.OrderNum;
SELECT T.Title, COUNT(L.UserID) AS LikesCount
FROM Likes L
JOIN Track T ON L.TrackID = T.TrackID
GROUP BY L.TrackID
ORDER BY LikesCount DESC;
SELECT * FROM TrackPlaylist;
INSERT INTO TrackPlaylist (PlaylistID, TrackID, OrderNum)
VALUES 
(1, 3, 1),  -- Kushal's playlist includes "Yellow"
(1, 4, 2),  -- Kushal's playlist also includes "Hello"
(2, 4, 1);  -- Neha's playlist includes "Hello"
SELECT P.Title AS PlaylistName, T.Title AS TrackTitle, TP.OrderNum
FROM TrackPlaylist TP
JOIN Playlist P ON TP.PlaylistID = P.PlaylistID
JOIN Track T ON TP.TrackID = T.TrackID
ORDER BY P.PlaylistID, TP.OrderNum;
UPDATE UserAccount
SET SubscriptionPlanID = 2
WHERE Username = 'Neha';
SELECT UserID, Username FROM UserAccount;
UPDATE UserAccount
SET SubscriptionPlanID = 2
WHERE UserID = 2;
SET SQL_SAFE_UPDATES = 0;
UPDATE UserAccount
SET SubscriptionPlanID = 2
WHERE Username = 'Neha';
SET SQL_SAFE_UPDATES = 1;
SELECT TrackID, Title FROM Track;
UPDATE Track
SET Title = 'Hello (Remastered)'
WHERE TrackID = 4;
SELECT TrackID, Title FROM Track;
DELETE FROM Likes
WHERE UserID = 2 AND TrackID = 3;  -- Remove Neha's like on "Yellow"
DELETE FROM TrackPlaylist
WHERE PlaylistID = 1 AND TrackID = 3;  -- Remove "Yellow" from Kushal's playlist
DELETE FROM Track
WHERE TrackID = 3;  -- Delete "Yellow"
SELECT *FROM Track;
-- TRIGGERS (timestamp is recorded when the user likes a track)
DELIMITER $$
CREATE TRIGGER before_like_insert
BEFORE INSERT ON Likes
FOR EACH ROW
BEGIN
    SET NEW.LikedAt = NOW();
END $$
DELIMITER ;
-- PROCEDURES (returns all the playlists created by the user)
DELIMITER $$
CREATE PROCEDURE GetPlaylistsByUser(IN userID INT)
BEGIN
    SELECT PlaylistID, Title, CreationDate
    FROM Playlist
    WHERE UserID = userID;
END $$
DELIMITER ;
-- FUNCTIONS (counts the number of tracks in the playlist)
DELIMITER $$
CREATE FUNCTION CountTracksInPlaylist(pPlaylistID INT)
RETURNS INT
DETERMINISTIC
BEGIN
    DECLARE trackCount INT;
    SELECT COUNT(*) INTO trackCount
    FROM TrackPlaylist
    WHERE PlaylistID = pPlaylistID;
    RETURN trackCount;
END $$
DELIMITER ;
-- TRIGGER EXECUTION
INSERT INTO Likes (UserID, TrackID) 
VALUES (2, 4);
SELECT * FROM Likes 
WHERE UserID = 2 AND TrackID = 4;
-- PROCEDURES EXECUTION
CALL GetPlaylistsByUser(1);
-- FUNCTIONS EXECUTION
SELECT CountTracksInPlaylist(1) AS TracksInPlaylist;
-- NESTED QUERIES (users who like a track)
SELECT Username
FROM UserAccount
WHERE UserID IN (
    SELECT UserID
    FROM Likes
    WHERE TrackID = 4  -- e.g., track "Hello (Remastered)"
);
-- JOIN QUERIES (list tracks with track information)
SELECT T.Title AS Track, AR.Name AS Artist, AL.Title AS Album
FROM Track T
JOIN Artist AR ON T.ArtistID = AR.ArtistID
JOIN Album AL ON T.AlbumID = AL.AlbumID;
-- SIMPLE AGGREGATE QUERIES (total payments per users)
SELECT U.Username, SUM(P.Amount) AS TotalPaid
FROM UserAccount U
JOIN Payment P ON U.UserID = P.UserID
GROUP BY U.UserID;

