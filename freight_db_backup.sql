CREATE DATABASE  IF NOT EXISTS "freight-application-db" /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `freight-application-db`;
-- MySQL dump 10.13  Distrib 8.0.45, for Win64 (x86_64)
--
-- Host: freight-application-freight-application.d.aivencloud.com    Database: freight-application-db
-- ------------------------------------------------------
-- Server version	8.0.45

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
SET @MYSQLDUMP_TEMP_LOG_BIN = @@SESSION.SQL_LOG_BIN;
SET @@SESSION.SQL_LOG_BIN= 0;

--
-- GTID state at the beginning of the backup 
--

SET @@GLOBAL.GTID_PURGED=/*!80000 '+'*/ '14fe7ccd-33d8-11f1-8b70-6a747bcbd312:1-113,
2c4dd50e-6898-11f1-9de4-722862c2b597:1-15,
3df9c762-2f10-11f1-aa65-8ee428239ae2:1-35,
6e750b8e-7299-11f1-b67c-460e85b6c779:1-15,
8d75273d-972e-11f1-bdb7-0662c0da8c08:1-18,
c8533ceb-c183-11f1-80aa-2ef00bd8d833:1-21,
fadcad42-b63a-11f1-8fa7-7aaec1edf540:1-15';

--
-- Table structure for table `driver_order_details`
--

DROP TABLE IF EXISTS `driver_order_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `driver_order_details` (
  `DriverOrderID` int NOT NULL AUTO_INCREMENT,
  `DriverIDs` int DEFAULT NULL,
  `OrderIDs` int DEFAULT NULL,
  PRIMARY KEY (`DriverOrderID`),
  KEY `fk_driver_idx` (`DriverIDs`),
  KEY `fk_order_idx` (`OrderIDs`),
  CONSTRAINT `fk_driver` FOREIGN KEY (`DriverIDs`) REFERENCES `drivers` (`DriverIDs`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_driver_order` FOREIGN KEY (`OrderIDs`) REFERENCES `shipping_orders` (`OrderID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `driver_order_details`
--

LOCK TABLES `driver_order_details` WRITE;
/*!40000 ALTER TABLE `driver_order_details` DISABLE KEYS */;
/*!40000 ALTER TABLE `driver_order_details` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `drivers`
--

DROP TABLE IF EXISTS `drivers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `drivers` (
  `DriverIDs` int NOT NULL AUTO_INCREMENT,
  `driver_name` varchar(45) DEFAULT NULL,
  `accountID` int DEFAULT NULL,
  `driver_link` varchar(45) DEFAULT NULL,
  `driver_license_plate_number` varchar(45) DEFAULT NULL,
  `driver_phone_number` varchar(45) DEFAULT NULL,
  `amount_of_gas` decimal(10,2) DEFAULT NULL,
  `money_amount_of_gas` decimal(10,2) DEFAULT NULL,
  `the_remaining_volume_of_the_car` float DEFAULT NULL,
  `the_remaining_weight_of_the_car` float DEFAULT NULL,
  `drop_off_distance` float DEFAULT NULL,
  `create_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`DriverIDs`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `drivers`
--

LOCK TABLES `drivers` WRITE;
/*!40000 ALTER TABLE `drivers` DISABLE KEYS */;
/*!40000 ALTER TABLE `drivers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shipping_orders`
--

DROP TABLE IF EXISTS `shipping_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shipping_orders` (
  `OrderID` int NOT NULL AUTO_INCREMENT,
  `order_name` varchar(100) DEFAULT NULL,
  `order_dispatch_date` datetime DEFAULT NULL,
  `sender_name` varchar(100) DEFAULT NULL,
  `receiver_name` varchar(100) DEFAULT NULL,
  `sender_address` varchar(255) DEFAULT NULL,
  `receiver_address` varchar(255) DEFAULT NULL,
  `sender_phone_number` varchar(20) DEFAULT NULL,
  `receiver_phone_number` varchar(20) DEFAULT NULL,
  `goods_quantity` int DEFAULT NULL,
  `goods_weight` decimal(10,2) DEFAULT NULL,
  `goods_volume` decimal(10,2) DEFAULT NULL,
  `note` varchar(45) DEFAULT NULL,
  `handling_instruction` varchar(45) DEFAULT NULL,
  `shipping_route` varchar(45) DEFAULT NULL,
  `shipping_status` varchar(45) DEFAULT NULL,
  `shipping_document` varchar(45) DEFAULT NULL,
  `shipping_payment` varchar(45) DEFAULT NULL,
  `shipping_position` varchar(45) DEFAULT NULL,
  `driver_name` varchar(100) DEFAULT NULL,
  `driver_license_plate` varchar(20) DEFAULT NULL,
  `driver_phone_number` varchar(45) DEFAULT NULL,
  `wagon_number` varchar(50) DEFAULT NULL,
  `wagon_departure_date` datetime DEFAULT NULL,
  `wagon_arrival_date` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `organization` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`OrderID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shipping_orders`
--

LOCK TABLES `shipping_orders` WRITE;
/*!40000 ALTER TABLE `shipping_orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `shipping_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shipping_wagons`
--

DROP TABLE IF EXISTS `shipping_wagons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shipping_wagons` (
  `WagonID` int NOT NULL AUTO_INCREMENT,
  `wagon_number` varchar(45) DEFAULT NULL,
  `wagon_departure_date` datetime DEFAULT NULL,
  `wagon_arrival_date` datetime DEFAULT NULL,
  `shipping_route` varchar(45) DEFAULT NULL,
  `create_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`WagonID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shipping_wagons`
--

LOCK TABLES `shipping_wagons` WRITE;
/*!40000 ALTER TABLE `shipping_wagons` DISABLE KEYS */;
/*!40000 ALTER TABLE `shipping_wagons` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user`
--

DROP TABLE IF EXISTS `user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user` (
  `ID` int NOT NULL AUTO_INCREMENT,
  `position` varchar(255) DEFAULT NULL,
  `organization` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `email_UNIQUE` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user`
--

LOCK TABLES `user` WRITE;
/*!40000 ALTER TABLE `user` DISABLE KEYS */;
INSERT INTO `user` VALUES (1,'Admin',NULL,'canhtoan.work000@gmail.com','$2b$10$7FYn.Rptx6thmvkL.JnlaeF7Wh8dO13Qv5RGVsCsTgx/29rcaWKgC','2026-04-03 10:57:00','2026-04-03 10:57:00'),(2,'Accountant',NULL,'accountant@gmail.com','$2b$10$HGuMzeB5g.o6WPyL9Vrnxu/Xp5eXIL46giOw4BpWsBaP/nYUHMwBK','2026-04-11 03:35:13','2026-04-11 03:37:26'),(3,'Partner',NULL,'partner@gmail.com','$2b$10$MLOrPuyWwaE5dh/0S4x.6Op7Hh23gq4iqbkpyQoCR0/b7fw7jIKsm','2026-04-11 03:38:08','2026-04-11 03:38:08'),(4,'Driver',NULL,'driver@gmail.com','$2b$10$f1ZulyzY9qhrmS0PqI9k.u0guEfXgFSYOWEnoWAI/otqptrXB4T6e','2026-04-11 03:38:22','2026-04-11 03:38:22'),(5,'Guest','Cty Phước Tá','guest@gmail.com','$2b$10$osaxSsGptQZQRsufu9TaIOYUkroRk4ObzvorZQqoKpbwAzXG4juhy','2026-04-11 03:38:37','2026-04-15 10:17:39'),(6,'QAStaff',NULL,'qastaff@gmail.com','$2b$10$.EBPYFORubf5VPSCzk44zuh8SN2v7P.XUYVIH8t9Ii8GJOsSrjPGK','2026-04-11 03:39:02','2026-04-11 03:39:02');
/*!40000 ALTER TABLE `user` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `wagon_details`
--

DROP TABLE IF EXISTS `wagon_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wagon_details` (
  `DetailID` int NOT NULL AUTO_INCREMENT,
  `WagonIDs` int DEFAULT NULL,
  `OrderIDs` int DEFAULT NULL,
  PRIMARY KEY (`DetailID`),
  KEY `fk_order_idx` (`OrderIDs`),
  KEY `fk_wagon_idx` (`WagonIDs`),
  CONSTRAINT `fk_order` FOREIGN KEY (`OrderIDs`) REFERENCES `shipping_orders` (`OrderID`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_wagon` FOREIGN KEY (`WagonIDs`) REFERENCES `shipping_wagons` (`WagonID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `wagon_details`
--

LOCK TABLES `wagon_details` WRITE;
/*!40000 ALTER TABLE `wagon_details` DISABLE KEYS */;
/*!40000 ALTER TABLE `wagon_details` ENABLE KEYS */;
UNLOCK TABLES;
SET @@SESSION.SQL_LOG_BIN = @MYSQLDUMP_TEMP_LOG_BIN;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-06 20:30:23
